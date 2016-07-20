'use strict';

const {BufferView} = require('./bufferView.js');
const {CursorView} = require('./cursorView.js');
const {GutterView} = require('./gutterView.js');
const {KeyListener} = require('./keyListener.js');
const {getSharedEditorSettings} = require('./utils.js');

const defaults = {
    name: '',
    tabName: '', // A unique identifier. May be the same as the pane's name. 
    keyMap: {},
    onKeyAction: (action) => { throw new Error('EditorPane: No handler for onKeyAction'); },
    onKeyError: (error) => { throw new Error('EditorPane: No handler for onKeyError.'); },
    horizontalCursorMargin: 1,  // columns
    verticalCursorMargin: 1,    // lines
    visibleHeight: '100%',
    visibleWidth: '100%',
    topOffset: '0px'
};

function EditorPane(parentElem, settings = defaults) {

    this.domNode = document.createElement('div');
    this.domNode.className = 'editor-pane';
    this.domNode.style.height = settings.visibleHeight || defaults.visibleHeight;
    this.domNode.style.width = settings.visibleWidth || defaults.visibleWidth;
    this.domNode.style.top = settings.topOffset || defaults.topOffset;
    this.domNode.tabIndex = 1;
    parentElem.appendChild(this.domNode);

    this.visibleHeight = this.domNode.clientHeight;
    this.visibleWidth = this.domNode.clientWidth;

    this.name = settings.name || defaults.name;
    this.tabName = settings.tabName || defaults.tabName;
    this.keyMap = settings.keyMap || defaults.keyMap;
    this.onKeyAction = settings.onKeyAction || defaults.onKeyAction;
    this.onKeyError = settings.onKeyError || defaults.onKeyError;
    this.horizontalCursorMargin = settings.horizontalCursorMargin || defaults.horizontalCursorMargin;
    this.verticalCursorMargin = settings.verticalCursorMargin || defaults.verticalCursorMargin;

    const sharedEditorSettings = getSharedEditorSettings(document.body);

    this.charWidth = sharedEditorSettings.charWidth;
    this.charHeight = sharedEditorSettings.charHeight;    

    this.gutterView = new GutterView(this.domNode, Object.assign({}, {onWidthChanged: (width) => this._onGutterWidthChanged(width)}, sharedEditorSettings));
    this.bufferView = new BufferView(this.domNode, Object.assign({}, {onClick: (pos) => this._onBufferMouseClick(pos)}, sharedEditorSettings));
    this.cursorView = new CursorView(this.domNode, sharedEditorSettings);

    this.keyListener = new KeyListener(this.domNode, {
        keyMap: this.keyMap,
        allowDefaultOnKeyError: false,
        onKeyAction: this.onKeyAction,
        onKeyError: this.onKeyError
    });

    this._initComponents();
    this._initEventListeners();
}

EditorPane.prototype._initComponents = function() {
    this.cursorView.setLeftOffset(this.gutterView.getWidth());
    this.bufferView.setLeftOffset(this.gutterView.getWidth()); 
    this.bufferView.setVisibleHeight(this.visibleHeight);
    this.bufferView.setVisibleWidth(this.visibleWidth - this.gutterView.getWidth());
};

EditorPane.prototype._initEventListeners = function() {

    this.domNode.addEventListener('scroll', (e) => {
        this.bufferView.setScrollTop(this.domNode.scrollTop);
        this.bufferView.setScrollLeft(this.domNode.scrollLeft);
        this.gutterView.setLeftOffset(this.domNode.scrollLeft);
    });
};

EditorPane.prototype._onBufferMouseClick = function(pos) {
    const [col, line] = pos;
    this.cursorView.moveTo(line, col);
    this.gutterView.setActiveLine(line);
};

EditorPane.prototype._onGutterWidthChanged = function(width) {
    this.cursorView.setLeftOffset(width);
    this.bufferView.setLeftOffset(width);
};

EditorPane.prototype.insert = function(text) {
    const line = this.bufferView.getLine(this.cursorView.line);
    const beforeInsert = line.slice(0, this.cursorView.col - 1);
    const afterInsert = line.slice(this.cursorView.col - 1);
    this.bufferView.setLine(this.cursorView.line, beforeInsert + text + afterInsert);
    this.cursorView.moveRight(text.length);

    this._checkScrollCursorIntoView();
};

EditorPane.prototype.insertNewLine = function() {
    const line = this.bufferView.getLine(this.cursorView.line);
    const toRemain = line.substr(0, this.cursorView.col - 1);
    const toGo = line.substr(this.cursorView.col - 1);

    this.bufferView.setLine(this.cursorView.line, toRemain);
    this.bufferView.insertLine(this.cursorView.line + 1, toGo);
    this.cursorView.moveTo(this.cursorView.line + 1, 1);
    this.gutterView.appendLine();
    this.gutterView.setActiveLine(this.cursorView.line);

    this._checkScrollCursorIntoView();
};

EditorPane.prototype.deleteBackChar = function() {
    if (this.cursorView.col === 1) {
        if (this.cursorView.line === 1) {
            return;
        }
        
        const prevLine = this.bufferView.getLine(this.cursorView.line - 1);
        this.bufferView.setLine(this.cursorView.line - 1,
                                prevLine + this.bufferView.getLine(this.cursorView.line));
        this.bufferView.removeLine(this.cursorView.line);
        this.cursorView.moveTo(this.cursorView.line - 1, prevLine.length + 1);
        this.gutterView.setActiveLine(this.cursorView.line);
        this.gutterView.removeLine();
    } else {
        const line = this.bufferView.getLine(this.cursorView.line);
        const beforeDelete = line.slice(0, this.cursorView.col - 2);
        const afterDelete = line.slice(this.cursorView.col - 1);
        this.bufferView.setLine(this.cursorView.line, beforeDelete + afterDelete);
        this.cursorView.moveLeft();
    }

     this._checkScrollCursorIntoView();
};

EditorPane.prototype.deleteForwardChar = function() {
    if (this.cursorView.col === this.bufferView.getLineWidthCols(this.cursorView.line) + 1) {
        if (this.cursorView.line < this.bufferView.getLastLineNum()) {
            const nextLine = this.bufferView.getLine(this.cursorView.line + 1);
            this.bufferView.removeLine(this.cursorView.line + 1);
            this.bufferView.setLine(this.cursorView.line, this.bufferView.getLine(this.cursorView.line) + nextLine);
        }
    } else {
        const line = this.bufferView.getLine(this.cursorView.line);
        this.bufferView.setLine(this.cursorView.line,
                                line.slice(0, this.cursorView.col - 1) +
                                line.slice(this.cursorView.col));
    }
};

EditorPane.prototype.killLine = function() {
    if (this.cursorView.col === this.bufferView.getLineWidthCols(this.cursorView.line) + 1) {
         if (this.cursorView.line < this.bufferView.getLastLineNum()) {
             const nextLine = this.bufferView.getLine(this.cursorView.line + 1);
             this.bufferView.removeLine(this.cursorView.line + 1);
             this.bufferView.setLine(this.cursorView.line, this.bufferView.getLine(this.cursorView.line) + nextLine);
             this.gutterView.removeLine();
        }
    } else {
        const lineUpToPoint = this.bufferView.getLine(this.cursorView.line).slice(0, this.cursorView.col - 1);
        this.bufferView.setLine(this.cursorView.line, lineUpToPoint);
    }
};

EditorPane.prototype.moveCursorLeft = function() {
    if (this.cursorView.col === 1) {
        if (this.cursorView.line !== 1) {
            const endOfPrevLine = this.bufferView.getLineWidthCols(this.cursorView.line - 1) + 1;
            this.cursorView.moveTo(this.cursorView.line - 1, endOfPrevLine);
            this.gutterView.setActiveLine(this.cursorView.line);

            this._checkScrollCursorIntoView();
        }
    } else {
        this.cursorView.moveLeft();

        this._checkScrollCursorIntoView();
    }
};

EditorPane.prototype.moveCursorRight = function() {
    if (this.cursorView.col === this.bufferView.getLineWidthCols(this.cursorView.line) + 1) {
        if (this.cursorView.line !== this.bufferView.getLastLineNum()) {
            this.cursorView.moveTo(this.cursorView.line + 1, 1);
            this.gutterView.setActiveLine(this.cursorView.line);

            this._checkScrollCursorIntoView();
        }
    } else {
        this.cursorView.moveRight();
        
        this._checkScrollCursorIntoView();
    }
};

EditorPane.prototype.moveCursorUp = function() {
    if (this.cursorView.line > 1) {
        this.cursorView.moveUp();
        this.gutterView.setActiveLine(this.cursorView.line);
        const lineWidth = this.bufferView.getLineWidthCols(this.cursorView.line);
        if (this.cursorView.col > lineWidth + 1) {
            this.cursorView.setCol(lineWidth + 1);
        }

        this._checkScrollCursorIntoView();
    }    
};

EditorPane.prototype.moveCursorDown = function() {
    if (this.cursorView.line < this.bufferView.getLastLineNum()) {
        this.cursorView.moveDown();
        this.gutterView.setActiveLine(this.cursorView.line);
        const lineWidth = this.bufferView.getLineWidthCols(this.cursorView.line);
        if (this.cursorView.col > lineWidth + 1) {
            this.cursorView.setCol(lineWidth + 1);
        }

        this._checkScrollCursorIntoView();
    }
};

EditorPane.prototype.moveCursorBeginningOfLine = function() {
    this.cursorView.setCol(1);
    this.cursorView.goalCol = this.cursorView.col;

    this._checkScrollCursorIntoView();
};

EditorPane.prototype.moveCursorEndOfLine = function() {
    this.cursorView.setCol(this.bufferView.getLineWidthCols(this.cursorView.line) + 1);
    this.cursorView.goalCol = this.cursorView.col;

    this._checkScrollCursorIntoView();
};

EditorPane.prototype.moveCursorTo = function(line, col) {
    if (line >= 1 && line <= this.bufferView.getLastLineNum() &&
        col >= 1 && col <= this.bufferView.getLineWidthCols(line) + 1) {
        this.cursorView.moveTo(line, col);
        this.gutterView.setActiveLine(this.cursorView.line);
        this._checkScrollCursorIntoView();
        return true;
    }
    return false;
};

// Sets the given line as the first visible.
EditorPane.prototype.scrollToLine = function(line) {
    const scrollTop = (line - 1) * this.charHeight;
    this.domNode.scrollTop = scrollTop;
    this.bufferView.setScrollTop(scrollTop);

    // TODO: It would be nice to ensure bufferView set its own height
    // correctly, be it in the css or programatically.
    if (this.bufferView.getHeight() < this.getHeight()) {
        this.bufferView.setHeight(this.getHeight());
    }
};

// Sets the given column as the first visible. 
EditorPane.prototype.scrollToCol = function(col) {
    const scrollLeft = (col - 1) * this.charWidth;
    this.domNode.scrollLeft = scrollLeft;
    this.bufferView.setScrollLeft(scrollLeft);
    this.gutterView.setLeftOffset(scrollLeft);

    // TODO: Would be nice if bufferView set its own width. See above.
    if (this.bufferView.getWidth() < this.getWidth()) {
        this.bufferView.setWidth(this.getWidth());
    }
};

EditorPane.prototype.show = function() {
    if (!this.isVisible()) {
        this.cursorView.show();
        this.domNode.classList.remove('editor-pane-hidden');
    }    
};

EditorPane.prototype.hide = function() {
    if (this.isVisible()) {
        this.cursorView.hide();
        this.domNode.classList.add('editor-pane-hidden');
    }    
};

EditorPane.prototype.isVisible = function() {
    return !this.domNode.classList.contains('editor-pane-hidden');
};

EditorPane.prototype.showGutter = function() {
    if (!this.gutterView.isVisible()) {
            console.log('showing');
        this.gutterView.show();
        const width = this.gutterView.getWidth();
        this.bufferView.setLeftOffset(this.bufferView.getLeftOffset() + width);
        this.cursorView.setLeftOffset(this.cursorView.getLeftOffset() + width);    
    }    
};

EditorPane.prototype.hideGutter = function() {
    if (this.gutterView.isVisible()) {
        this.gutterView.hide();
        const width = this.gutterView.getWidth();
        this.bufferView.setLeftOffset(this.bufferView.getLeftOffset() - width);
        this.cursorView.setLeftOffset(this.cursorView.getLeftOffset() - width);        
    }
};

EditorPane.prototype.setActive = function(on) {
    this.cursorView.setBlink(true);
    this.domNode.focus();
    this.domNode.classList.remove('editor-pane-inactive');    
};

EditorPane.prototype.setInactive = function() {
    this.cursorView.setBlink(false);
    this.domNode.blur();
    
    // Idempotent - don't have to worry about whether the
    // class is already present.
    this.domNode.classList.add('editor-pane-inactive');    
};

EditorPane.prototype.setCursorBlink = function(on) {
    this.cursorView.setBlink(on);
};

EditorPane.prototype.setLeftOffset = function(to) {
    this.domNode.style.left = to + 'px';
};

EditorPane.prototype.setTopOffset = function(to) {
    this.domNode.style.top = to + 'px';
};

EditorPane.prototype.setVisibleHeight = function(to) {
    this.visibleHeight = to;
    this.domNode.style.height = to + 'px';
    this.bufferView.setVisibleHeight(this.visibleHeight);
    this.gutterView.setLeftOffset(this.domNode.scrollLeft);
};

EditorPane.prototype.setVisibleWidth = function(to) {
    // TODO: Set domNode.style.width.
    this.visibleWidth = to;
    this.bufferView.setVisibleWidth(this.visibleWidth - this.gutterView.getWidth());
};

EditorPane.prototype.getCursorPosition = function() {
    return [this.cursorView.line, this.cursorView.col];
};

EditorPane.prototype.getHeight = function() {
    const height = parseInt(this.domNode.style.height) || this.domNode.scrollHeight;
    if (height == null) {
        throw new Error('EditorPane: Unable to parse height.');
    }
    return height;
};

EditorPane.prototype.getVisibleHeight = function() {
    return this.visibleHeight;
};

EditorPane.prototype.getWidth = function() {
    const width = parseInt(this.domNode.style.width) || this.domNode.scrollWidth;
    if (width == null) {
        throw new Error('EditorPane: Unable to parse width.');
    }
    return width;
};

EditorPane.prototype.getVisibleWidth = function() {
    return this.visibleWidth;
};

EditorPane.prototype._checkScrollCursorIntoView = function() {
    if (this.cursorView.col < this.bufferView.getFirstVisibleCol() + this.horizontalCursorMargin) {
        const firstVisible = Math.max(1, this.cursorView.col - 10);
        this.scrollToCol(firstVisible);    
    } else if (this.cursorView.col > this.bufferView.getLastVisibleCol() - this.horizontalCursorMargin) {
        const lastVisible = Math.min(this.cursorView.col + 10, this.bufferView.getLastColNum());
        const firstVisible = lastVisible - this.bufferView.getVisibleWidthCols() + 1;
        this.scrollToCol(firstVisible);
    }

    if (this.cursorView.line < this.bufferView.getFirstVisibleLineNum() + this.verticalCursorMargin) {
        const firstVisible = Math.max(1, this.cursorView.line - 10);
        this.scrollToLine(firstVisible); 
    } else if (this.cursorView.line > this.bufferView.getLastVisibleLineNum() - this.verticalCursorMargin) {
        const lastVisible = Math.min(this.cursorView.line + 10, this.bufferView.getLastLineNum());
        const firstVisible = lastVisible - this.bufferView.getVisibleHeightLines() + 1;
        this.scrollToLine(firstVisible);
    }
};

module.exports.EditorPane = EditorPane;
