const {BufferView} = require('./bufferView.js'); 
const {CursorView} = require('./cursorView.js');
const {GutterView} = require('./gutterView.js');
const {viewHelpers} = require('./viewHelpers.js');

function EditorPaneController(domRoot, bufferView, cursorView, gutterView) {
    console.log('EditorPaneController created.');

    const sharedViewConfig = viewHelpers.getSharedViewConfig(domRoot);

    this.bufferView = bufferView || new BufferView(domRoot, sharedViewConfig);
    this.cursorView = cursorView || new CursorView(domRoot, sharedViewConfig);
    this.gutterView = gutterView || new GutterView(domRoot, sharedViewConfig); 

    document.body.addEventListener('keydown', (e) => {
        e.preventDefault();
        const keyMap = {
            'Enter': {type: 'INSERT_NEW_LINE'},
            'ArrowLeft': {type: 'MOVE_CURSOR_LEFT'},
            'ArrowRight': {type: 'MOVE_CURSOR_RIGHT'},
            'ArrowUp': {type: 'MOVE_CURSOR_UP'},
            'ArrowDown': {type: 'MOVE_CURSOR_DOWN'}
        };

        const action = keyMap[e.key];
        if (action) {
            this.handleAction(action); 
        } else if (e.key !== 'Shift' && e.key !== 'Backspace' && e.key !== 'Meta'){
            this.handleAction({
                type: 'INSERT',
                key: e.key
            });
        }
    });
}

EditorPaneController.prototype.handleAction = function(action) {
    console.log('EditorPaneController: Handling action ' + action);
    switch (action.type) {
    case 'INSERT':
        this.bufferView.changeLine(this.cursorView.row,
                                   this.bufferView.lineElems[this.cursorView.row].innerHTML.slice(0, this.cursorView.col) +
                                   action.key +
                                   this.bufferView.lineElems[this.cursorView.row].innerHTML.slice(this.cursorView.col));
        this.cursorView.moveRight();
        break;
	case 'INSERT_NEW_LINE':
        this.bufferView.insertLine(this.cursorView.row + 1, '');
        this.cursorView.moveTo(1, this.cursorView.row + 1);
        this.gutterView.appendRow();
        this.gutterView.setActiveRow(this.cursorView.row);
        break;
        // case 'INSERT_TAB':
	    // case 'DELETE_BACK_CHAR':
        // case 'DELETE_FORWARD_CHAR':
	    // case 'DELETE_BACK_WORD':
	    // case 'DELETE_FORWARD_WORD':
	    // case 'KILL_BACK_LINE':
	    // case 'KILL_FORWARD_LINE':
	    // case 'KILL_LINE':
	    // case 'REPEAT_LAST_ACTION':
	    // case 'UNDO_ACTION':
	    // case 'REDO_ACTION':
	    // case 'SEARCH_BACK':
	    // case 'WRAP_LINES':
	    // case 'GET_SENTENCE_BEGINNING':
	    // case 'GET_SENTENCE_END':
	    // case 'GET_PARAGRAPH_BEGINNING':
	    // case 'GET_PARAGRAPH_END':
	    // case 'GET_LINE':
	    // case 'GET_MAX_OFFSET_FOR_LINE':
	    // case 'GET_LINE_RANGE':
	    // case 'GET_LINES':
	    // case 'SET_MODE':
    case 'MOVE_CURSOR_LEFT':
        if (this.cursorView.col > 1) {
            this.cursorView.moveLeft();
        }
        break;
	case 'MOVE_CURSOR_RIGHT':
        if (this.cursorView.col < this.bufferView.maxColumns) {
            this.cursorView.moveRight();            
        }
        break;
	case 'MOVE_CURSOR_UP':
        if (this.cursorView.row > 1) {
            this.cursorView.moveUp();
            this.gutterView.setActiveRow(this.cursorView.row);
        }
        break;
	case 'MOVE_CURSOR_DOWN':
        if (this.cursorView.row < this.bufferView.lastRowNum()) {
            this.cursorView.moveDown();
            this.gutterView.setActiveRow(this.cursorView.row); 
        }
        break;
	    // case 'MOVE_CURSOR_END_OF_LINE':
	    // case 'MOVE_CURSOR_BEGINNING_OF_LINE':
	    // case 'MOVE_CURSOR_BUFFER_END':
	    // case 'MOVE_CURSOR_BUFFER_BEGINNING':
	    // case 'MOVE_CURSOR_END_OF_PARAGRAPH':
	    // case 'MOVE_CURSOR_BEGINNING_OF_PARAGRAPH':
	    // case 'MOVE_CURSOR_END_OF_SENTENCE':
	    // case 'MOVE_CURSOR_BEGINNING_OF_SENTENCE':
	    // case 'MOVE_CURSOR_PREV_POS':
	    // case 'SCROLL_UP':
	    // case 'SCROLL_DOWN':
	    // case 'PAGE_UP':
	    // case 'PAGE_DOWN':
    default:
        throw new Error('EditorPaneController: Action handler not implemented.'); 
    }
};

module.exports.EditorPaneController = EditorPaneController;