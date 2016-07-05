'use strict';

const {BufferView} = require('./bufferView.js');
const {CursorView} = require('./cursorView.js');
const {GutterView} = require('./gutterView.js');
const {viewHelpers} = require('./viewHelpers.js');

const defaultSettings = {
    scrollLinesOnOutOfRangeCursor: 10
};

function EditorPane(parentElem, config = defaultSettings) {

    this.scrollLinesOnOutOfRangeCursor = config.scrollLinesOnOutOfRangeCursor || defaultSettings.scrollLinesOnOutOfRangeCursor;

    this.domNode = document.createElement('div');
    this.domNode.className = 'editor-pane';
    this.domNode.tabIndex = 1;
    
    parentElem.appendChild(this.domNode);

    const sharedViewConfig = viewHelpers.getSharedViewConfig(document.body);

    this.bufferView = new BufferView(this.domNode, sharedViewConfig);
    this.cursorView = new CursorView(this.domNode, sharedViewConfig);
    this.gutterView = new GutterView(this.domNode, sharedViewConfig);

    this._initComponents();
}

EditorPane.prototype._initComponents = function() {

    this.bufferView.setLeftOffset(this.gutterView.getWidth()); 
    this.cursorView.setLeftOffset(this.gutterView.getWidth());

    this.bufferView.onScroll((event) => {
        this.cursorView.setScrollTop(this.bufferView.getScrollTop());
        this.gutterView.setScrollTop(this.bufferView.getScrollTop());
    });

    this.gutterView.onWidthChanged((width) => {
        this.cursorView.setLeftOffset(width);
        this.bufferView.setLeftOffset(width); 
    });
};

EditorPane.prototype.setFocused = function() {
    this.domNode.focus();
};

EditorPane.prototype.insertText = function(text) {
    const line = this.bufferView.getLine(this.cursorView.line);
    const beforeInsert = line.slice(0, this.cursorView.col - 1);
    const afterInsert = line.slice(this.cursorView.col - 1);
    this.bufferView.setLine(this.cursorView.line, beforeInsert + text + afterInsert);
    this.cursorView.moveRight(text.length);
};

EditorPane.prototype.insertNewLine = function() {
    const line = this.bufferView.getLine(this.cursorView.line);
    const toRemain = line.substr(0, this.cursorView.col - 1);
    const toGo = line.substr(this.cursorView.col - 1);

    this.bufferView.setLine(this.cursorView.line, toRemain);
    this.bufferView.insertLine(this.cursorView.line + 1, toGo);
    this.cursorView.moveTo(1, this.cursorView.line + 1);
    this.gutterView.appendLine();
    this.gutterView.setActiveLine(this.cursorView.line);

    if (this.cursorView.line > this.bufferView.getLastVisibleLineNum()) {
        this.bufferView.scrollDownLine(this.scrollLinesOnOutOfRangeCursor);
       // this.gutterView.setScrollTop(this.bufferView.getScrollTop());
    }
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
        this.cursorView.moveTo(prevLine.length + 1, this.cursorView.line - 1);
        this.gutterView.setActiveLine(this.cursorView.line);
        this.gutterView.removeLine();

        if (this.cursorView.line < this.bufferView.getFirstVisibleLineNum()) {
            this.bufferView.scrollUpLine(this.scrollLinesOnOutOfRangeCursor);
        }
    } else {
        const line = this.bufferView.getLine(this.cursorView.line);
        const beforeDelete = line.slice(0, this.cursorView.col - 2);
        const afterDelete = line.slice(this.cursorView.col - 1);
        this.bufferView.setLine(this.cursorView.line, beforeDelete + afterDelete);
        this.cursorView.moveLeft();             
    }
};

EditorPane.prototype.deleteForwardChar = function() {
    if (this.cursorView.col === this.bufferView.getLineWidthChars(this.cursorView.line) + 1) {
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
    if (this.cursorView.col === this.bufferView.getLineWidthChars(this.cursorView.line) + 1) {
         if (this.cursorView.line < this.bufferView.getLastLineNum()) {
            const nextLine = this.bufferView.getLine(this.cursorView.line + 1);
            this.bufferView.removeLine(this.cursorView.line + 1);
            this.bufferView.setLine(this.cursorView.line, this.bufferView.getLine(this.cursorView.line) + nextLine);
        }
    } else {
        this.bufferView.setLine(this.cursorView.line,
            this.bufferView.getLine(this.cursorView.line).slice(0, this.cursorView.col - 1));    
    }
};

EditorPane.prototype.moveCursorLeft = function() {
    if (this.cursorView.col === 1) {
        if (this.cursorView.line !== 1) {
            const endOfPrevLine = this.bufferView.getLineWidthChars(this.cursorView.line) + 1;
            this.cursorView.moveTo(endOfPrevLine, this.cursorView.line - 1);

            if (this.cursorView.line < this.bufferView.getFirstVisibleLineNum()) {
                this.bufferView.scrollUpLine(this.scrollLinesOnOutOfRangeCursor);
                this.gutterView.setActiveLine(this.cursorView.line);
            }
        }
    } else {
         this.cursorView.moveLeft();        
    }
};

EditorPane.prototype.moveCursorRight = function() {
    if (this.cursorView.col === this.bufferView.getLineWidthChars(this.cursorView.line) + 1) {
        if (this.cursorView.line !== this.bufferView.getLastLineNum()) {
            this.cursorView.moveTo(1, this.cursorView.line + 1);

            if (this.cursorView.line > this.bufferView.getLastVisibleLineNum()) {
                this.bufferView.scrollDownLine(this.scrollLinesOnOutOfRangeCursor);
                this.gutterView.setActiveLine(this.cursorView.line);
            }
        }
    } else {
        this.cursorView.moveRight();            
    }
};

EditorPane.prototype.moveCursorUp = function() {
    if (this.cursorView.line > 1) {
        this.cursorView.moveUp();
        this.gutterView.setActiveLine(this.cursorView.line);
        const lineWidth = this.bufferView.getLineWidthChars(this.cursorView.line);
        if (this.cursorView.col > lineWidth + 1) {
            this.cursorView.setCol(lineWidth + 1);
        }
        if (this.cursorView.line < this.bufferView.getFirstVisibleLineNum()) {
            this.bufferView.scrollUpLine(this.scrollLinesOnOutOfRangeCursor);
        }
    }    
};

EditorPane.prototype.moveCursorDown = function() {
    if (this.cursorView.line < this.bufferView.getLastLineNum()) {
        this.cursorView.moveDown();
        this.gutterView.setActiveLine(this.cursorView.line); 
        const lineWidth = this.bufferView.getLineWidthChars(this.cursorView.line);
        if (this.cursorView.col > lineWidth + 1) {
            this.cursorView.setCol(lineWidth + 1);
        }
        if (this.cursorView.line > this.bufferView.getLastVisibleLineNum()) {
            this.bufferView.scrollDownLine(this.scrollLinesOnOutOfRangeCursor); 
        }
    }
};

EditorPane.prototype.moveCursorBeginningOfLine = function() {
    this.cursorView.setCol(1);
    this.cursorView.goalCol = this.cursorView.col;
};

EditorPane.prototype.moveCursorEndOfLine = function() {
    this.cursorView.setCol(this.bufferView.getLineWidthChars(this.cursorView.line) + 1);
    this.cursorView.goalCol = this.cursorView.col;
};

module.exports.EditorPane = EditorPane;
