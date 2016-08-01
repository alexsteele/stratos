'use strict';

// TODO: Make line, col indexing consistent between model and view.

const BufferModel = require('./bufferModel.js');
const BufferView = require('./bufferView.js');
const CursorView = require('./cursorView.js');
const GutterView = require('./gutterView.js');
const KeyListener = require('./keyListener.js');

const defaults = {
    name: '',
    tabName: '', // A unique identifier. May be the same as the pane's name. 
    keyMap: {},
    horizontalCursorMargin: 1,  // columns
    verticalCursorMargin: 1,    // lines
    height: '100%',
    width: '100%',
    topOffset: '0px',
    sharedEditorComponentSettings: {
        charWidth: 0,
        charheight: 0
    },
    onUnknownAction: (action) => { throw new Error('Pane: No handler for action: ' + action); },
    onCursorMoved: (line, col) => { throw new Error('Pane: No handler for onCursorMoved.'); }
};

function Pane(parentElem, settings = defaults) {

    this.domNode = document.createElement('div');
    this.domNode.className = 'pane';
    this.domNode.style.height = settings.height || defaults.height;
    this.domNode.style.width = settings.width || defaults.width;
    this.domNode.style.top = settings.topOffset || defaults.topOffset;
    this.domNode.tabIndex = 1;
    parentElem.appendChild(this.domNode);

    this.model = new BufferModel();

    this.name = settings.name || defaults.name;
    this.tabName = settings.tabName || defaults.tabName;
    this.keyMap = settings.keyMap || defaults.keyMap;
    this.onCursorMoved = settings.onCursorMoved || defaults.onCursorMoved;
    this.onUnknownAction = settings.onUnknownAction || defaults.onUnknownAction;
    this.horizontalCursorMargin = settings.horizontalCursorMargin || defaults.horizontalCursorMargin;
    this.verticalCursorMargin = settings.verticalCursorMargin || defaults.verticalCursorMargin;
    
    const sharedEditorSettings = settings.sharedEditorComponentSettings || defaults.sharedEditorComponentSettings;
    this.charWidth = sharedEditorSettings.charWidth;
    this.charHeight = sharedEditorSettings.charHeight;    
    this.gutterView = new GutterView(this.domNode, Object.assign({}, {onWidthChanged: (width) => this._onGutterWidthChanged(width)}, sharedEditorSettings));
    this.bufferView = new BufferView(this.domNode, Object.assign({}, {onClick: (line, col) => this._onBufferClick(line, col)}, sharedEditorSettings));
    this.cursorView = new CursorView(this.domNode, sharedEditorSettings);

    this.keyListener = new KeyListener(this.domNode, {
        keyMap: this.keyMap,
        allowDefaultOnKeyError: false,
        onKeyAction: (action) => this._handleAction(action),
        onKeyError: (error) => this._handleKeyError(error)
    });

    this._initComponents();
    this._initEventListeners();

    // Inactive by default.
    this.setInactive();
}

Pane.prototype._initComponents = function() {
    this.model.appendLine();
    this.cursorView.setLeftOffset(this.gutterView.getWidth());
    this.bufferView.setLeftOffset(this.gutterView.getWidth()); 
    this.bufferView.setVisibleHeight(this.getHeight());
    this.bufferView.setVisibleWidth(this.getWidth() - this.gutterView.getWidth());
};

Pane.prototype._initEventListeners = function() {
    this.domNode.addEventListener('scroll', (e) => {
        this.bufferView.setScrollTop(this.domNode.scrollTop);
        this.bufferView.setScrollLeft(this.domNode.scrollLeft);
        this.gutterView.setLeftOffset(this.domNode.scrollLeft);
    });
};

Pane.prototype._onBufferClick = function(line, col) {
    if (!this.isActive()) return;
    
    this.cursorView.moveTo(line, col);
    this.gutterView.setActiveLine(line);
    this.onCursorMoved(line, col);
};

Pane.prototype._onGutterWidthChanged = function(width) {
    this.cursorView.setLeftOffset(width);
    this.bufferView.setLeftOffset(width);
};

Pane.prototype.insert = function(text) {
    this.model.insert(this.cursorView.line - 1, this.cursorView.col - 1, text);
    this.bufferView.setLine(this.cursorView.line, this.model.getLine(this.cursorView.line - 1));
    this.cursorView.moveRight(text.length);

    this._checkScrollCursorIntoView();
    this._emitCursorMoved();
};

Pane.prototype.insertNewLine = function() {
    this.model.insertNewLine(this.cursorView.line - 1, this.cursorView.col - 1);
    this.bufferView.setLine(this.cursorView.line, this.model.getLine(this.cursorView.line - 1));
    this.bufferView.insertLine(this.cursorView.line + 1, this.model.getLine(this.cursorView.line));
    this.cursorView.moveTo(this.cursorView.line + 1, 1);
    this.gutterView.appendLine();
    this.gutterView.setActiveLine(this.cursorView.line);

    this._checkScrollCursorIntoView();
    this._emitCursorMoved();
};

Pane.prototype.deleteBackChar = function() {
    if (this.cursorView.col === 1) {
        if (this.cursorView.line === 1) {
            return;
        }

        // TODO: Move logic into model.

        const prevLine = this.model.getLine(this.cursorView.line - 2);
        const line = prevLine + this.model.getLine(this.cursorView.line - 1);
        this.model.setLine(this.cursorView.line - 2, line);
        this.model.deleteLine(this.cursorView.line - 1);
        
        this.bufferView.setLine(this.cursorView.line - 1, line);
        this.bufferView.removeLine(this.cursorView.line);
        this.cursorView.moveTo(this.cursorView.line - 1, prevLine.length + 1);
        this.gutterView.setActiveLine(this.cursorView.line);
        this.gutterView.removeLine();
    } else {
        this.model.deleteBack(this.cursorView.line - 1, this.cursorView.col - 1);
        this.bufferView.setLine(this.cursorView.line, this.model.getLine(this.cursorView.line - 1));
        this.cursorView.moveLeft();
    }

    this._checkScrollCursorIntoView();
    this._emitCursorMoved();
};

Pane.prototype.deleteForwardChar = function() {
    if (this.cursorView.col === this.bufferView.getLineWidthCols(this.cursorView.line) + 1) {
        if (this.cursorView.line === this.bufferView.getLastLineNum()) {
            return;
        }

        // TODO: ^ Ditto ^
        const currLine = this.model.getLine(this.cursorView.line - 1);
        const nextLine = this.model.getLine(this.cursorView.line);
        this.model.setLine(this.cursorView.line - 1, currLine + nextLine);
        this.model.deleteLine(this.cursorView.line);
        
        this.bufferView.removeLine(this.cursorView.line + 1);
        this.bufferView.setLine(this.cursorView.line, this.model.getLine(this.cursorView.line - 1));
    } else {
        this.model.deleteForward(this.cursorView.line - 1, this.cursorView.col - 1);
        this.bufferView.setLine(this.cursorView.line, this.model.getLine(this.cursorView.line - 1));
    }
};

Pane.prototype.killLine = function() {
    if (this.cursorView.col === this.bufferView.getLineWidthCols(this.cursorView.line) + 1) {
        if (this.cursorView.line === this.bufferView.getLastLineNum()) {
            return;
        }

        // TODO: Ditto
        
        const nextLine = this.model.getLine(this.cursorView.line);
        this.model.deleteLine(this.cursorView.line);
        this.model.setLine(this.cursorView.line - 1, this.model.getLine(this.cursorView.line - 1) + nextLine);
        this.bufferView.removeLine(this.cursorView.line + 1);
        this.bufferView.setLine(this.cursorView.line, this.model.getLine(this.cursorView.line - 1));
        this.gutterView.removeLine();
    } else {
        const lineUpToPoint = this.model.getLine(this.cursorView.line - 1).slice(0, this.cursorView.col - 1);
        this.model.setLine(this.cursorView.line - 1, lineUpToPoint);
        this.bufferView.setLine(this.cursorView.line, lineUpToPoint);
    }
};

Pane.prototype.moveCursorLeft = function() {
    if (this.cursorView.col === 1) {
        if (this.cursorView.line === 1) {
            return;
        }
        const endOfPrevLine = this.bufferView.getLineWidthCols(this.cursorView.line - 1) + 1;
        this.cursorView.moveTo(this.cursorView.line - 1, endOfPrevLine);
        this.gutterView.setActiveLine(this.cursorView.line);
    } else {
        this.cursorView.moveLeft();
    }

    this._checkScrollCursorIntoView();
    this._emitCursorMoved();
};

Pane.prototype.moveCursorRight = function() {
    if (this.cursorView.col === this.bufferView.getLineWidthCols(this.cursorView.line) + 1) {
        if (this.cursorView.line === this.bufferView.getLastLineNum()) {
            return;
        }
        this.cursorView.moveTo(this.cursorView.line + 1, 1);
        this.gutterView.setActiveLine(this.cursorView.line);
    } else {
        this.cursorView.moveRight();
    }

    this._checkScrollCursorIntoView();
    this._emitCursorMoved();
};

Pane.prototype.moveCursorUp = function() {
    if (this.cursorView.line === 1) {
        return;
    }
    
    this.cursorView.moveUp();
    this.gutterView.setActiveLine(this.cursorView.line);
    const lineWidth = this.bufferView.getLineWidthCols(this.cursorView.line);
    if (this.cursorView.col > lineWidth + 1) {
        this.cursorView.setCol(lineWidth + 1);
    }

    this._checkScrollCursorIntoView();
    this._emitCursorMoved();
};

Pane.prototype.moveCursorDown = function() {
    if (this.cursorView.line === this.bufferView.getLastLineNum()) {
        return;
    }
    
    this.cursorView.moveDown();
    this.gutterView.setActiveLine(this.cursorView.line);
    const lineWidth = this.bufferView.getLineWidthCols(this.cursorView.line);
    if (this.cursorView.col > lineWidth + 1) {
        this.cursorView.setCol(lineWidth + 1);
    }

    this._checkScrollCursorIntoView();
    this._emitCursorMoved();
};

Pane.prototype.moveCursorForwardWord = function() {
    const [line, col] = this.model.getNextWordEnd(this.cursorView.line - 1, this.cursorView.col - 1);
    this.cursorView.moveTo(line + 1, col + 1);

    this._checkScrollCursorIntoView();
    this._emitCursorMoved();
};

Pane.prototype.moveCursorBackWord = function() {
    const [line, col] = this.model.getLastWordStart(this.cursorView.line - 1, this.cursorView.col - 1);
    this.cursorView.moveTo(line + 1, col + 1);

    this._checkScrollCursorIntoView();
    this._emitCursorMoved();
};

Pane.prototype.moveCursorBeginningOfLine = function() {
    this.cursorView.setCol(1);
    this.cursorView.goalCol = this.cursorView.col;

    this._checkScrollCursorIntoView();
    this._emitCursorMoved();
};

Pane.prototype.moveCursorEndOfLine = function() {
    this.cursorView.setCol(this.bufferView.getLineWidthCols(this.cursorView.line) + 1);
    this.cursorView.goalCol = this.cursorView.col;

    this._checkScrollCursorIntoView();
    this._emitCursorMoved();
};

Pane.prototype.moveCursorTo = function(line, col) {
    if (line >= 1 && line <= this.bufferView.getLastLineNum() &&
        col >= 1 && col <= this.bufferView.getLineWidthCols(line) + 1) {
        this.cursorView.moveTo(line, col);
        this.gutterView.setActiveLine(this.cursorView.line);
        
        this._checkScrollCursorIntoView();
        this._emitCursorMoved();
    }
};

// Sets the given line as the first visible.
Pane.prototype.scrollToLine = function(line) {
    const scrollTop = (line - 1) * this.charHeight;
    this.domNode.scrollTop = scrollTop;
    this.bufferView.setScrollTop(scrollTop);
};

// Sets the given column as the first visible. 
Pane.prototype.scrollToCol = function(col) {
    const scrollLeft = (col - 1) * this.charWidth;
    this.domNode.scrollLeft = scrollLeft;
    this.bufferView.setScrollLeft(scrollLeft);
    this.gutterView.setLeftOffset(scrollLeft);
};

Pane.prototype.show = function() {
    if (!this.isVisible()) {
        this.cursorView.show();
        this.domNode.classList.remove('editor-pane-hidden');
    }    
};

Pane.prototype.hide = function() {
    if (this.isVisible()) {
        this.cursorView.hide();
        this.domNode.classList.add('editor-pane-hidden');
    }    
};

Pane.prototype.isVisible = function() {
    return !this.domNode.classList.contains('editor-pane-hidden');
};

Pane.prototype.showGutter = function() {
    if (!this.gutterView.isVisible()) {
        this.gutterView.show();
        const width = this.gutterView.getWidth();
        this.bufferView.setLeftOffset(width);
        this.cursorView.setLeftOffset(width);
    }
};

Pane.prototype.hideGutter = function() {
    if (this.gutterView.isVisible()) {
        this.gutterView.hide();
        const width = this.gutterView.getWidth();
        this.bufferView.setLeftOffset(width);
        this.cursorView.setLeftOffset(width);
    }
};

Pane.prototype.setActive = function(on) {
    this.cursorView.setBlink(true);
    this.domNode.focus();
    this.domNode.classList.remove('editor-pane-inactive');    
};

Pane.prototype.setInactive = function() {
    this.cursorView.setBlink(false);
    this.domNode.blur();
    this.domNode.classList.add('editor-pane-inactive');    
};

Pane.prototype.isActive = function() {
    return !this.domNode.classList.contains('editor-pane-inactive');
};

Pane.prototype.setCursorBlink = function(on) {
    this.cursorView.setBlink(on);
};

Pane.prototype.setLeftOffset = function(to) {
    this.domNode.style.left = to + 'px';
};

Pane.prototype.setTopOffset = function(to) {
    this.domNode.style.top = to + 'px';
};

Pane.prototype.setHeight = function(to) {
    this.domNode.style.height = to + 'px';
    this.bufferView.setVisibleHeight(this.getHeight());
};

Pane.prototype.setWidth = function(to) {
    this.domNode.style.width = to + 'px';
    this.bufferView.setVisibleWidth(this.getWidth() - this.gutterView.getWidth());
};

Pane.prototype.getCursorPosition = function() {
    return [this.cursorView.line, this.cursorView.col];
};

Pane.prototype.getHeight = function() {
    const height = parseInt(this.domNode.style.height);
    if (height == null) {
        throw new Error('Pane: Unable to parse height.');
    }
    return height;
};

Pane.prototype.getWidth = function() {
    const width = parseInt(this.domNode.style.width);
    if (width == null) {
        throw new Error('Pane: Unable to parse width.');
    }
    return width;
};

Pane.prototype._checkScrollCursorIntoView = function() {

    // Horizontal alignment
    if (this.cursorView.col < this.bufferView.getFirstVisibleCol() + this.horizontalCursorMargin) {
        const firstVisible = Math.max(1, this.cursorView.col - this.horizontalCursorMargin);
        this.scrollToCol(firstVisible);
    } else if (this.cursorView.col > this.bufferView.getLastVisibleCol() - this.horizontalCursorMargin) {
        const lastVisible = Math.min(this.cursorView.col + this.horizontalCursorMargin, this.bufferView.getLastColNum());
        const firstVisible = lastVisible - this.bufferView.getVisibleWidthCols() + 1;
        this.scrollToCol(firstVisible);
    }

    // Vertical alignment
    if (this.cursorView.line < this.bufferView.getFirstVisibleLineNum() + this.verticalCursorMargin) {
        const firstVisible = Math.max(1, this.cursorView.line - this.verticalCursorMargin);
        this.scrollToLine(firstVisible); 
    } else if (this.cursorView.line > this.bufferView.getLastVisibleLineNum() - this.verticalCursorMargin) {
        const lastVisible = Math.min(this.cursorView.line + this.verticalCursorMargin, this.bufferView.getLastLineNum());
        const firstVisible = lastVisible - this.bufferView.getVisibleHeightLines() + 1;
        this.scrollToLine(firstVisible);
    }

};

Pane.prototype._handleAction = function(action) {

    const actionHandlers = {
        'INSERT':                        action => this.insert(action.text),
        'INSERT_NEW_LINE':               () => this.insertNewLine(),
        'DELETE_BACK_CHAR':              () => this.deleteBackChar(),
        'DELETE_FORWARD_CHAR':           () => this.deleteForwardChar(),
        'KILL_LINE':                     () => this.killLine(),
        'MOVE_TO_POS':                   action => this.moveCursorTo(action.line, action.col),
        'MOVE_CURSOR_LEFT':              () => this.moveCursorLeft(),
        'MOVE_CURSOR_RIGHT':             () => this.moveCursorRight(),
        'MOVE_CURSOR_UP':                () => this.moveCursorUp(),
        'MOVE_CURSOR_DOWN':              () => this.moveCursorDown(),
        'MOVE_CURSOR_FORWARD_WORD':      () => this.moveCursorForwardWord(),
        'MOVE_CURSOR_BACK_WORD':         () => this.moveCursorBackWord(),
        'MOVE_CURSOR_BEGINNING_OF_LINE': () => this.moveCursorBeginningOfLine(),
        'MOVE_CURSOR_END_OF_LINE':       () => this.moveCursorEndOfLine(),
        'SHOW_GUTTER':                   () => this.showGutter(),
        'HIDE_GUTTER':                   () => this.hideGutter()
    };

    const handler = actionHandlers[action.type];

    if (handler) {
        handler(action);
    } else {
        this.onUnknownAction(action);
    }
};

Pane.prototype._handleKeyError = function(error) {
    console.log('Pane: key error: ' + error);
};

Pane.prototype._emitCursorMoved = function() {
    this.onCursorMoved(this.cursorView.line, this.cursorView.col);
};

module.exports = Pane;
