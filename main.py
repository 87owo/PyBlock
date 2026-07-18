import os
import subprocess
import threading
import webbrowser

from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'project'))
HOST = '127.0.0.1'
PORT = 5000
APP_URL = f'http://{HOST}:{PORT}'

os.makedirs(PROJECT_DIR, exist_ok=True)
running_processes = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/projects', methods=['GET'])
def list_projects():
    projects = [f[:-3] for f in os.listdir(PROJECT_DIR) if f.endswith('.py')]
    return jsonify(projects)

@app.route('/api/project/<name>', methods=['GET', 'POST'])
def handle_project(name):
    filepath = os.path.join(PROJECT_DIR, f"{name}.py")
    xml_filepath = os.path.join(PROJECT_DIR, f"{name}.xml")
    if request.method == 'GET':
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                code = f.read()
            xml_content = ''
            if os.path.exists(xml_filepath):
                with open(xml_filepath, 'r', encoding='utf-8') as f:
                    xml_content = f.read()
            return jsonify({'code': code, 'xml': xml_content})
        return jsonify({'error': 'Not found'}), 404
    if request.method == 'POST':
        req_data = request.get_json(silent=True) or {}
        code = req_data.get('code', '')
        xml_content = req_data.get('xml', '')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(code)
        if xml_content:
            with open(xml_filepath, 'w', encoding='utf-8') as f:
                f.write(xml_content)
        return jsonify({'success': True})

@app.route('/api/run', methods=['POST'])
def run_project():
    req_data = request.get_json(silent=True) or {}
    name = req_data.get('name')
    filepath = os.path.join(PROJECT_DIR, f"{name}.py")
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    if name in running_processes:
        running_processes[name].kill()
    
    try:
        process = subprocess.Popen(
            ['python', '-u', filepath], 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            text=True
        )
        running_processes[name] = process
        stdout, stderr = process.communicate(timeout=10)
        running_processes.pop(name, None)
        return jsonify({'output': stdout, 'error': stderr})
    except subprocess.TimeoutExpired:
        process.kill()
        stdout, stderr = process.communicate()
        running_processes.pop(name, None)
        return jsonify({'output': stdout, 'error': 'Execution Timeout (10s)'})
    except Exception as e:
        running_processes.pop(name, None)
        return jsonify({'error': str(e)}), 500

@app.route('/api/stop', methods=['POST'])
def stop_project():
    req_data = request.get_json(silent=True) or {}
    name = req_data.get('name')
    if name in running_processes:
        running_processes[name].kill()
        running_processes.pop(name, None)
        return jsonify({'success': True})
    return jsonify({'success': False})

def open_browser():
    webbrowser.open(APP_URL)

if __name__ == '__main__':
    default_project = os.path.join(PROJECT_DIR, 'project_1.py')
    if not os.path.exists(default_project):
        with open(default_project, 'w', encoding='utf-8'):
            pass
    
    browser_timer = threading.Timer(1.0, open_browser)
    browser_timer.daemon = True
    browser_timer.start()
    app.run(host=HOST, port=PORT, debug=True, use_reloader=False)
