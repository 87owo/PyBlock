class BlockOS {
    constructor() {
        this.workspace = null;
        this.currentLang = 'zh-TW';
        this.currentProject = 'project_1';
        this.colors = {
            EVENTS: '#FFBF00', 
            CONTROL: '#FFAB19', 
            VARS: '#FF8C1A',
            MATH: '#59C059'
        };
        this.init();
    }

    init() {
        try {
            this.changeLanguage(this.currentLang);
            this.registerBlocks();
            this.initWorkspace();
            this.bindEvents();
            this.loadProjects();
            this.loadProject(this.currentProject);
        } catch (e) {
            console.error(e);
        }
    }

    changeLanguage(lang) {
        if (!i18nDict[lang]) return;
        this.currentLang = lang;
        
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (i18nDict[lang].UI[key]) el.textContent = i18nDict[lang].UI[key];
        });
        
        Object.keys(i18nDict[lang].B).forEach(key => {
            Blockly.Msg[key] = i18nDict[lang].B[key];
        });
        
        if (this.workspace) {
            const state = Blockly.serialization.workspaces.save(this.workspace);
            this.workspace.updateToolbox(this.buildToolbox());
            this.workspace.clear();
            Blockly.serialization.workspaces.load(state, this.workspace);
        }
    }

    createBlockSpec(type, msgKey, args, colorKey, isStatement = true, hasOutput = false) {
        let message = `%{BKY_${msgKey}}`;
        const baseStr = i18nDict['zh-TW'].B[msgKey] || "";
        const match = baseStr.match(/%\d+/g);
        const expectedArgsCount = match ? match.length : 0;

        for (let i = expectedArgsCount + 1; i <= args.length; i++) {
            message += ` %${i}`;
        }

        const spec = { 
            type, 
            message0: message, 
            colour: this.colors[colorKey] 
        };

        if (args.length > 0) {
            spec.args0 = args;
        }
        
        if (hasOutput) {
            spec.output = null;
        } else if (isStatement) {
            spec.previousStatement = null;
            spec.nextStatement = null;
        }
        return spec;
    }

    getGenerator() {
        if (typeof pythonGenerator !== 'undefined') return pythonGenerator;
        if (window.Blockly && window.Blockly.Python) return window.Blockly.Python;
        if (window.python && window.python.pythonGenerator) return window.python.pythonGenerator;
        return null;
    }

    registerBlocks() {
        const I = (name) => ({ type: "input_value", name });
        const S = (name) => ({ type: "input_statement", name });
        const F = (name, text) => ({ type: "field_input", name, text });
        const D = (name, options) => ({ type: "field_dropdown", name, options });

        const defMap = [
            ['ev_main', 'EV_MAIN', [S('DO')], 'EVENTS', true, false],
            ['ev_import', 'EV_IMPORT', [I('MOD')], 'EVENTS', true, false],
            ['ev_from', 'EV_FROM', [I('MOD'), I('ITEMS')], 'EVENTS', true, false],
            ['ev_class', 'EV_CLASS', [F('NAME', 'MyClass'), F('BASE', 'object'), S('DO')], 'EVENTS', true, false],
            ['ev_def', 'EV_DEF', [F('NAME', 'func'), I('ARGS'), S('DO')], 'EVENTS', true, false],
            ['func_call_stmt', 'FUNC_CALL_STMT', [F('FUNC', 'print'), I('ARGS')], 'EVENTS', true, false],
            ['func_call_val', 'FUNC_CALL_VAL', [F('FUNC', 'len'), I('ARGS')], 'EVENTS', false, true],

            ['ctrl_for', 'CTRL_FOR', [F('VAR', 'i'), I('ITER'), S('DO')], 'CONTROL', true, false],
            ['ctrl_while', 'CTRL_WHILE', [I('COND'), S('DO')], 'CONTROL', true, false],
            ['ctrl_if', 'CTRL_IF', [I('COND'), S('DO')], 'CONTROL', true, false],
            ['ctrl_if_else', 'CTRL_IF_ELSE', [I('COND'), S('DO_IF'), S('DO_ELSE')], 'CONTROL', true, false],
            ['ctrl_break', 'CTRL_BREAK', [], 'CONTROL', true, false],
            ['ctrl_continue', 'CTRL_CONTINUE', [], 'CONTROL', true, false],
            ['ctrl_pass', 'CTRL_PASS', [], 'CONTROL', true, false],
            ['ctrl_return', 'CTRL_RETURN', [I('VAL')], 'CONTROL', true, false],
            ['ctrl_try', 'CTRL_TRY', [S('DO_TRY'), F('ERR', 'Exception'), S('DO_EXC')], 'CONTROL', true, false],
            ['ctrl_with', 'CTRL_WITH', [I('ITEM'), F('VAR', 'f'), S('DO')], 'CONTROL', true, false],

            ['var_get', 'VAR_GET', [F('VAR', 'x')], 'VARS', false, true],
            ['var_set', 'VAR_SET', [F('VAR', 'x'), I('VAL')], 'VARS', true, false],
            ['obj_set_item', 'OBJ_SET_ITEM', [F('OBJ', 'x'), I('KEY'), I('VAL')], 'VARS', true, false],
            ['obj_get_item', 'OBJ_GET_ITEM', [F('OBJ', 'x'), I('KEY')], 'VARS', false, true],
            ['var_global', 'VAR_GLOBAL', [F('VAR', 'x')], 'VARS', true, false],
            ['var_del', 'VAR_DEL', [F('VAR', 'x')], 'VARS', true, false],

            ['op_num', 'OP_NUM', [F('VAL', '0')], 'MATH', false, true],
            ['op_str', 'OP_STR', [F('VAL', 'text')], 'MATH', false, true],
            ['op_tuple', 'OP_TUPLE', [I('ITEMS')], 'MATH', false, true],
            ['op_list', 'OP_LIST', [I('ITEMS')], 'MATH', false, true],
            ['op_dict', 'OP_DICT', [I('ITEMS')], 'MATH', false, true],
            ['op_bool', 'OP_BOOL', [D('VAL', [['True', 'True'], ['False', 'False']])], 'MATH', false, true],
            ['op_none', 'OP_NONE', [], 'MATH', false, true],
            ['op_arithmetic', 'OP_ARITHMETIC', [I('A'), D('OP', [['+', '+'], ['-', '-'], ['*', '*'], ['/', '/'], ['//', '//'], ['%', '%'], ['**', '**']]), I('B')], 'MATH', false, true],
            ['op_compare', 'OP_COMPARE', [I('A'), D('OP', [['==', '=='], ['!=', '!='], ['>', '>'], ['<', '<'], ['>=', '>='], ['<=', '<='], ['in', 'in'], ['not in', 'not in'], ['is', 'is'], ['is not', 'is not']]), I('B')], 'MATH', false, true],
            ['op_logical', 'OP_LOGICAL', [I('A'), D('OP', [['and', 'and'], ['or', 'or']]), I('B')], 'MATH', false, true],
            ['op_not', 'OP_NOT', [I('A')], 'MATH', false, true],
            ['op_join', 'OP_JOIN', [I('A'), I('B')], 'MATH', false, true],
            ['op_stararg', 'OP_STARARG', [I('VAL')], 'MATH', false, true],
            ['op_kwstararg', 'OP_KWSTARARG', [I('VAL')], 'MATH', false, true],
            ['op_dict_kv', 'OP_DICT_KV', [I('KEY'), I('VAL')], 'MATH', false, true]
        ];

        defMap.forEach(row => {
            const spec = this.createBlockSpec(row[0], row[1], row[2], row[3], row[4], row[5]);
            Blockly.Blocks[spec.type] = {
                init: function() { this.jsonInit(spec); }
            };
        });

        const python = this.getGenerator();
        if (!python) return;

        const blockDefs = python.forBlock || python;
        
        const Order = python.Order || {
            ATOMIC: 0, MEMBER: 1, FUNCTION_CALL: 2, EXPONENTIATION: 3,
            BITWISE_NOT: 4, MULTIPLICATIVE: 5, ADDITIVE: 6, BITWISE_SHIFT: 7,
            BITWISE_AND: 8, BITWISE_XOR: 9, BITWISE_OR: 10, RELATIONAL: 11,
            LOGICAL_NOT: 12, LOGICAL_AND: 13, LOGICAL_OR: 14, CONDITIONAL: 15,
            LAMBDA: 16, NONE: 99
        };

        const getOrder = (key) => Order[key] !== undefined ? Order[key] : (python['ORDER_' + key] || 99);

        const val = (b, n, order = getOrder('NONE')) => python.valueToCode(b, n, order);
        const stmt = (b, n) => python.statementToCode(b, n) || '  pass\n';
        const field = (b, n) => b.getFieldValue(n);

        blockDefs['ev_main'] = b => `if __name__ == '__main__':\n${stmt(b, 'DO')}`;
        blockDefs['ev_import'] = b => `import ${val(b, 'MOD') || ''}\n`;
        blockDefs['ev_from'] = b => `from ${val(b, 'MOD') || ''} import ${val(b, 'ITEMS') || ''}\n`;
        blockDefs['ev_class'] = b => `class ${field(b, 'NAME')}(${field(b, 'BASE')}):\n${stmt(b, 'DO')}`;
        blockDefs['ev_def'] = b => `def ${field(b, 'NAME')}(${val(b, 'ARGS') || ''}):\n${stmt(b, 'DO')}`;
        blockDefs['func_call_stmt'] = b => `${field(b, 'FUNC')}(${val(b, 'ARGS') || ''})\n`;
        blockDefs['func_call_val'] = b => [`${field(b, 'FUNC')}(${val(b, 'ARGS') || ''})`, getOrder('FUNCTION_CALL')];

        blockDefs['ctrl_for'] = b => {
            const iterCode = val(b, 'ITER') || '[]';
            const iterVal = (!isNaN(iterCode) && iterCode.trim() !== '') ? `range(${iterCode})` : iterCode;
            return `for ${field(b, 'VAR')} in ${iterVal}:\n${stmt(b, 'DO')}`;
        };
        blockDefs['ctrl_while'] = b => `while ${val(b, 'COND') || 'True'}:\n${stmt(b, 'DO')}`;
        blockDefs['ctrl_if'] = b => `if ${val(b, 'COND') || 'False'}:\n${stmt(b, 'DO')}`;
        blockDefs['ctrl_if_else'] = b => `if ${val(b, 'COND') || 'False'}:\n${stmt(b, 'DO_IF')}else:\n${stmt(b, 'DO_ELSE')}`;
        blockDefs['ctrl_break'] = b => `break\n`;
        blockDefs['ctrl_continue'] = b => `continue\n`;
        blockDefs['ctrl_pass'] = b => `pass\n`;
        blockDefs['ctrl_return'] = b => `return ${val(b, 'VAL') || 'None'}\n`;
        blockDefs['ctrl_try'] = b => `try:\n${stmt(b, 'DO_TRY')}except ${field(b, 'ERR')} as e:\n${stmt(b, 'DO_EXC')}`;
        blockDefs['ctrl_with'] = b => {
            const item = val(b, 'ITEM') || 'None';
            const varName = field(b, 'VAR');
            const doCode = stmt(b, 'DO');
            if (varName && varName.trim() !== '') {
                return `with ${item} as ${varName}:\n${doCode}`;
            }
            return `with ${item}:\n${doCode}`;
        };

        blockDefs['var_get'] = b => [`${field(b, 'VAR')}`, getOrder('ATOMIC')];
        blockDefs['var_set'] = b => `${field(b, 'VAR')} = ${val(b, 'VAL') || 'None'}\n`;
        blockDefs['obj_set_item'] = b => `${field(b, 'OBJ')}[${val(b, 'KEY') || '0'}] = ${val(b, 'VAL') || 'None'}\n`;
        blockDefs['obj_get_item'] = b => [`${field(b, 'OBJ')}[${val(b, 'KEY') || '0'}]`, getOrder('MEMBER')];
        blockDefs['var_global'] = b => `global ${field(b, 'VAR')}\n`;
        blockDefs['var_del'] = b => `del ${field(b, 'VAR')}\n`;

        blockDefs['op_num'] = b => [`${field(b, 'VAL') || '0'}`, getOrder('ATOMIC')];
        blockDefs['op_str'] = b => [`${JSON.stringify(field(b, 'VAL') || '')}`, getOrder('ATOMIC')];
        blockDefs['op_tuple'] = b => [`(${val(b, 'ITEMS') || ''})`, getOrder('ATOMIC')];
        blockDefs['op_list'] = b => [`[${val(b, 'ITEMS') || ''}]`, getOrder('ATOMIC')];
        blockDefs['op_dict'] = b => [`{${val(b, 'ITEMS') || ''}}`, getOrder('ATOMIC')];
        blockDefs['op_bool'] = b => [`${field(b, 'VAL')}`, getOrder('ATOMIC')];
        blockDefs['op_none'] = b => ['None', getOrder('ATOMIC')];
        blockDefs['op_arithmetic'] = b => {
            const op = field(b, 'OP');
            let order = getOrder('MULTIPLICATIVE');
            if (op === '+' || op === '-') order = getOrder('ADDITIVE');
            if (op === '**') order = getOrder('EXPONENTIATION');
            return [`${val(b, 'A')} ${op} ${val(b, 'B')}`, order];
        };
        blockDefs['op_compare'] = b => [`${val(b, 'A')} ${field(b, 'OP')} ${val(b, 'B')}`, getOrder('RELATIONAL')];
        blockDefs['op_logical'] = b => {
            const op = field(b, 'OP');
            return [`${val(b, 'A')} ${op} ${val(b, 'B')}`, op === 'and' ? getOrder('LOGICAL_AND') : getOrder('LOGICAL_OR')];
        };
        blockDefs['op_not'] = b => [`not ${val(b, 'A')}`, getOrder('LOGICAL_NOT')];
        blockDefs['op_join'] = b => [`${val(b, 'A') || ''}, ${val(b, 'B') || ''}`, getOrder('NONE')];
        blockDefs['op_stararg'] = b => [`*${val(b, 'VAL') || ''}`, getOrder('NONE')];
        blockDefs['op_kwstararg'] = b => [`**${val(b, 'VAL') || ''}`, getOrder('NONE')];
        blockDefs['op_dict_kv'] = b => [`${val(b, 'KEY')}: ${val(b, 'VAL')}`, getOrder('NONE')];
    }

    buildToolbox() {
        const buildCategory = (name, key, color, blocks) => `
            <category name="%{BKY_CAT_${key}}" colour="${color}">
                ${blocks.map(b => `<block type="${b}"></block>`).join('')}
            </category>`;
            
        return `<xml id="toolbox" style="display: none">
            ${buildCategory('Events', 'EVENTS', this.colors.EVENTS, ['ev_main', 'ev_import', 'ev_from', 'ev_class', 'ev_def', 'func_call_stmt', 'func_call_val'])}
            ${buildCategory('Control', 'CONTROL', this.colors.CONTROL, ['ctrl_for', 'ctrl_while', 'ctrl_if', 'ctrl_if_else', 'ctrl_break', 'ctrl_continue', 'ctrl_pass', 'ctrl_return', 'ctrl_try', 'ctrl_with'])}
            ${buildCategory('Variables', 'VARS', this.colors.VARS, ['var_get', 'var_set', 'obj_set_item', 'obj_get_item', 'var_global', 'var_del'])}
            ${buildCategory('Operators', 'MATH', this.colors.MATH, ['op_num', 'op_str', 'op_tuple', 'op_list', 'op_dict', 'op_bool', 'op_none', 'op_arithmetic', 'op_compare', 'op_logical', 'op_not', 'op_join', 'op_stararg', 'op_kwstararg', 'op_dict_kv'])}
        </xml>`;
    }

    initWorkspace() {
        try {
            this.workspace = Blockly.inject('blocklyDiv', {
                toolbox: this.buildToolbox(),
                grid: { spacing: 20, length: 3, colour: '#ccc', snap: true },
                zoom: { controls: true, wheel: true }
            });
            
            this.workspace.addChangeListener((e) => {
                if (e.isUiEvent || e.type === 'ui' || e.type === 'viewport_change' || e.type === 'drag') return;
                clearTimeout(this._codeUpdateTimer);
                this._codeUpdateTimer = setTimeout(() => {
                    this.updateCodePreview();
                }, 50);
            });
        } catch (e) {}
    }

    updateCodePreview() {
        const codeBox = document.getElementById('pythonCode');
        if (!codeBox) return;

        try {
            const python = this.getGenerator();
            if (python && this.workspace) {
                const code = python.workspaceToCode(this.workspace);
                codeBox.textContent = code;
            }
        } catch (e) {
            codeBox.textContent = `# ${e.message}`;
        }
    }

    bindEvents() {
        document.getElementById('btnNew').onclick = () => {
            const name = prompt('Enter project name:');
            if (name) {
                this.currentProject = name;
                this.workspace.clear();
                this.saveProject();
                this.loadProjects();
            }
        };
        
        document.getElementById('btnSave').onclick = () => this.saveProject();
        document.getElementById('btnRun').onclick = () => this.runProject();
        document.getElementById('btnStop').onclick = () => this.stopProject();
    }

    async loadProjects() {
        const res = await fetch('/api/projects');
        const projects = await res.json();
        const list = document.getElementById('fileList');
        list.innerHTML = '';
        projects.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p + '.py';
            if (p === this.currentProject) li.classList.add('active');
            li.onclick = () => this.loadProject(p);
            list.appendChild(li);
        });
        document.getElementById('currentProjectName').textContent = this.currentProject;
    }

    async loadProject(name) {
        this.currentProject = name;
        this.loadProjects();
        const res = await fetch(`/api/project/${name}`);
        if (res.ok) {
            const data = await res.json();
            
            Blockly.Events.disable();
            try {
                document.getElementById('pythonCode').textContent = data.code;
                this.workspace.clear();
                if (data.xml) {
                    const dom = Blockly.utils.xml.textToDom(data.xml);
                    Blockly.Xml.domToWorkspace(dom, this.workspace);
                }
            } catch (e) {
                console.error("Workspace load error:", e);
            } finally {
                Blockly.Events.enable();
            }
        }
    }

    async saveProject() {
        const python = this.getGenerator();
        const code = python ? python.workspaceToCode(this.workspace) : '';
        const xmlDom = Blockly.Xml.workspaceToDom(this.workspace);
        const xmlText = Blockly.Xml.domToText(xmlDom);
        await fetch(`/api/project/${this.currentProject}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, xml: xmlText })
        });
        const term = document.getElementById('terminalOutput');
        if (term) {
            term.textContent += `\n[System] Project ${this.currentProject} saved.\n`;
        }
    }

    async runProject() {
        await this.saveProject();
        const term = document.getElementById('terminalOutput');
        term.textContent = 'Running...\n';
        
        try {
            const res = await fetch('/api/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: this.currentProject })
            });
            const data = await res.json();
            
            let outputText = data.output || '';
            if (data.error) {
                outputText += `\n[Error]\n${data.error}`;
            }
            term.textContent = outputText;
        } catch (e) {
            term.textContent += `\n[Request Failed] ${e.message}`;
        }
    }

    async stopProject() {
        const term = document.getElementById('terminalOutput');
        term.textContent += '\nStopping...\n';
        await fetch('/api/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: this.currentProject })
        });
    }
}

const app = new BlockOS();