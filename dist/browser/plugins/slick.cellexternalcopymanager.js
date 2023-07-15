"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: !0, configurable: !0, writable: !0, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => (__defNormalProp(obj, typeof key != "symbol" ? key + "" : key, value), value);

  // src/plugins/slick.cellexternalcopymanager.ts
  var SlickEvent = Slick.Event, Utils = Slick.Utils, CLEAR_COPY_SELECTION_DELAY = 2e3, CLIPBOARD_PASTE_DELAY = 100, SlickCellExternalCopyManager = class {
    constructor(options) {
      // --
      // public API
      __publicField(this, "pluginName", "CellExternalCopyManager");
      __publicField(this, "onCopyCells", new SlickEvent());
      __publicField(this, "onCopyCancelled", new SlickEvent());
      __publicField(this, "onPasteCells", new SlickEvent());
      // --
      // protected props
      __publicField(this, "_grid");
      __publicField(this, "_bodyElement");
      __publicField(this, "_copiedRanges", null);
      __publicField(this, "_clearCopyTI");
      __publicField(this, "_clipCommand");
      __publicField(this, "_copiedCellStyle");
      __publicField(this, "_copiedCellStyleLayerKey");
      __publicField(this, "_onCopyInit");
      __publicField(this, "_onCopySuccess");
      __publicField(this, "_options");
      __publicField(this, "keyCodes", {
        C: 67,
        V: 86,
        ESC: 27,
        INSERT: 45
      });
      this._options = options || {}, this._copiedCellStyleLayerKey = this._options.copiedCellStyleLayerKey || "copy-manager", this._copiedCellStyle = this._options.copiedCellStyle || "copied", this._bodyElement = this._options.bodyElement || document.body, this._onCopyInit = this._options.onCopyInit || void 0, this._onCopySuccess = this._options.onCopySuccess || void 0;
    }
    init(grid) {
      this._grid = grid, this._grid.onKeyDown.subscribe(this.handleKeyDown.bind(this));
      let cellSelectionModel = grid.getSelectionModel();
      if (!cellSelectionModel)
        throw new Error("Selection model is mandatory for this plugin. Please set a selection model on the grid before adding this plugin: grid.setSelectionModel(new Slick.CellSelectionModel())");
      cellSelectionModel.onSelectedRangesChanged.subscribe(() => {
        this._grid.getEditorLock().isActive() || this._grid.focus();
      });
    }
    destroy() {
      this._grid.onKeyDown.unsubscribe(this.handleKeyDown.bind(this));
    }
    getHeaderValueForColumn(columnDef) {
      if (this._options.headerColumnValueExtractor) {
        let val = this._options.headerColumnValueExtractor(columnDef);
        if (val)
          return val;
      }
      return columnDef.name;
    }
    getDataItemValueForColumn(item, columnDef, event) {
      if (typeof this._options.dataItemColumnValueExtractor == "function") {
        let val = this._options.dataItemColumnValueExtractor(item, columnDef);
        if (val)
          return val;
      }
      let retVal = "";
      if (columnDef != null && columnDef.editor) {
        let tmpP = document.createElement("p"), editor = new columnDef.editor({
          container: tmpP,
          // a dummy container
          column: columnDef,
          event,
          position: { top: 0, left: 0 },
          // a dummy position required by some editors
          grid: this._grid
        });
        editor.loadValue(item), retVal = editor.serializeValue(), editor.destroy(), tmpP.remove();
      } else
        retVal = item[columnDef.field || ""];
      return retVal;
    }
    setDataItemValueForColumn(item, columnDef, value) {
      if (columnDef.denyPaste)
        return null;
      if (this._options.dataItemColumnValueSetter)
        return this._options.dataItemColumnValueSetter(item, columnDef, value);
      if (columnDef.editor) {
        let tmpDiv = document.createElement("div"), editor = new columnDef.editor({
          container: tmpDiv,
          // a dummy container
          column: columnDef,
          position: { top: 0, left: 0 },
          // a dummy position required by some editors
          grid: this._grid
        });
        editor.loadValue(item), editor.applyValue(item, value), editor.destroy(), tmpDiv.remove();
      } else
        item[columnDef.field] = value;
    }
    _createTextBox(innerText) {
      let ta = document.createElement("textarea");
      return ta.style.position = "absolute", ta.style.left = "-1000px", ta.style.top = document.body.scrollTop + "px", ta.value = innerText, this._bodyElement.appendChild(ta), ta.select(), ta;
    }
    _decodeTabularData(grid, ta) {
      let columns = grid.getColumns(), clipRows = ta.value.split(/[\n\f\r]/);
      clipRows[clipRows.length - 1] === "" && clipRows.pop();
      let j = 0, clippedRange = [];
      this._bodyElement.removeChild(ta);
      for (let i = 0; i < clipRows.length; i++)
        clipRows[i] !== "" ? clippedRange[j++] = clipRows[i].split("	") : clippedRange[j++] = [""];
      let selectedCell = grid.getActiveCell(), ranges = grid.getSelectionModel().getSelectedRanges(), selectedRange = ranges && ranges.length ? ranges[0] : null, activeRow, activeCell;
      if (selectedRange)
        activeRow = selectedRange.fromRow, activeCell = selectedRange.fromCell;
      else if (selectedCell)
        activeRow = selectedCell.row, activeCell = selectedCell.cell;
      else
        return;
      let oneCellToMultiple = !1, destH = clippedRange.length, destW = clippedRange.length ? clippedRange[0].length : 0;
      clippedRange.length == 1 && clippedRange[0].length == 1 && selectedRange && (oneCellToMultiple = !0, destH = selectedRange.toRow - selectedRange.fromRow + 1, destW = selectedRange.toCell - selectedRange.fromCell + 1);
      let availableRows = grid.getData().length - (activeRow || 0), addRows = 0;
      if (availableRows < destH && typeof this._options.newRowCreator == "function") {
        let d = grid.getData();
        for (addRows = 1; addRows <= destH - availableRows; addRows++)
          d.push({});
        grid.setData(d), grid.render();
      }
      let overflowsBottomOfGrid = (activeRow || 0) + destH > grid.getDataLength();
      if (this._options.newRowCreator && overflowsBottomOfGrid) {
        let newRowsNeeded = (activeRow || 0) + destH - grid.getDataLength();
        this._options.newRowCreator(newRowsNeeded);
      }
      this._clipCommand = {
        isClipboardCommand: !0,
        clippedRange,
        oldValues: [],
        cellExternalCopyManager: this,
        _options: this._options,
        setDataItemValueForColumn: this.setDataItemValueForColumn.bind(this),
        markCopySelection: this.markCopySelection.bind(this),
        oneCellToMultiple,
        activeRow,
        activeCell,
        destH,
        destW,
        maxDestY: grid.getDataLength(),
        maxDestX: grid.getColumns().length,
        h: 0,
        w: 0,
        execute: () => {
          this._clipCommand.h = 0;
          for (let y = 0; y < this._clipCommand.destH; y++) {
            this._clipCommand.oldValues[y] = [], this._clipCommand.w = 0, this._clipCommand.h++;
            for (let x = 0; x < this._clipCommand.destW; x++) {
              this._clipCommand.w++;
              let desty = activeRow + y, destx = activeCell + x;
              if (desty < this._clipCommand.maxDestY && destx < this._clipCommand.maxDestX) {
                let dt = grid.getDataItem(desty);
                this._clipCommand.oldValues[y][x] = dt[columns[destx].field], oneCellToMultiple ? this._clipCommand.setDataItemValueForColumn(dt, columns[destx], clippedRange[0][0]) : this._clipCommand.setDataItemValueForColumn(dt, columns[destx], clippedRange[y] ? clippedRange[y][x] : ""), grid.updateCell(desty, destx), grid.onCellChange.notify({
                  row: desty,
                  cell: destx,
                  item: dt,
                  grid,
                  column: {}
                });
              }
            }
          }
          let bRange = {
            fromCell: activeCell,
            fromRow: activeRow,
            toCell: activeCell + this._clipCommand.w - 1,
            toRow: activeRow + this._clipCommand.h - 1
          };
          this.markCopySelection([bRange]), grid.getSelectionModel().setSelectedRanges([bRange]), this.onPasteCells.notify({ ranges: [bRange] });
        },
        undo: () => {
          for (let y = 0; y < this._clipCommand.destH; y++)
            for (let x = 0; x < this._clipCommand.destW; x++) {
              let desty = activeRow + y, destx = activeCell + x;
              if (desty < this._clipCommand.maxDestY && destx < this._clipCommand.maxDestX) {
                let dt = grid.getDataItem(desty);
                oneCellToMultiple ? this._clipCommand.setDataItemValueForColumn(dt, columns[destx], this._clipCommand.oldValues[0][0]) : this._clipCommand.setDataItemValueForColumn(dt, columns[destx], this._clipCommand.oldValues[y][x]), grid.updateCell(desty, destx), grid.onCellChange.notify({
                  row: desty,
                  cell: destx,
                  item: dt,
                  grid,
                  column: {}
                });
              }
            }
          let bRange = {
            fromCell: activeCell,
            fromRow: activeRow,
            toCell: activeCell + this._clipCommand.w - 1,
            toRow: activeRow + this._clipCommand.h - 1
          };
          if (this.markCopySelection([bRange]), grid.getSelectionModel().setSelectedRanges([bRange]), typeof this._options.onPasteCells == "function" && this.onPasteCells.notify({ ranges: [bRange] }), addRows > 1) {
            let d = grid.getData();
            for (; addRows > 1; addRows--)
              d.splice(d.length - 1, 1);
            grid.setData(d), grid.render();
          }
        }
      }, typeof this._options.clipboardCommandHandler == "function" ? this._options.clipboardCommandHandler(this._clipCommand) : this._clipCommand.execute();
    }
    handleKeyDown(e) {
      var _a, _b;
      let ranges;
      if (!this._grid.getEditorLock().isActive() || this._grid.getOptions().autoEdit) {
        if (e.which == this.keyCodes.ESC && this._copiedRanges && (e.preventDefault(), this.clearCopySelection(), this.onCopyCancelled.notify({ ranges: this._copiedRanges }), this._copiedRanges = null), (e.which === this.keyCodes.C || e.which === this.keyCodes.INSERT) && (e.ctrlKey || e.metaKey) && !e.shiftKey && (typeof this._onCopyInit == "function" && this._onCopyInit.call(this), ranges = this._grid.getSelectionModel().getSelectedRanges(), ranges.length !== 0)) {
          this._copiedRanges = ranges, this.markCopySelection(ranges), this.onCopyCells.notify({ ranges });
          let columns = this._grid.getColumns(), clipText = "";
          for (let rg = 0; rg < ranges.length; rg++) {
            let range = ranges[rg], clipTextRows = [];
            for (let i = range.fromRow; i < range.toRow + 1; i++) {
              let clipTextCells = [], dt = this._grid.getDataItem(i);
              if (clipTextRows.length === 0 && this._options.includeHeaderWhenCopying) {
                let clipTextHeaders = [];
                for (let j = range.fromCell; j < range.toCell + 1; j++)
                  columns[j].name.length > 0 && !columns[j].hidden && clipTextHeaders.push(this.getHeaderValueForColumn(columns[j]));
                clipTextRows.push(clipTextHeaders.join("	"));
              }
              for (let j = range.fromCell; j < range.toCell + 1; j++)
                columns[j].name.length > 0 && !columns[j].hidden && clipTextCells.push(this.getDataItemValueForColumn(dt, columns[j], e));
              clipTextRows.push(clipTextCells.join("	"));
            }
            clipText += clipTextRows.join(`\r
`) + `\r
`;
          }
          if (window.clipboardData)
            return window.clipboardData.setData("Text", clipText), !0;
          {
            let focusEl = document.activeElement, ta = this._createTextBox(clipText);
            if (ta.focus(), setTimeout(() => {
              this._bodyElement.removeChild(ta), focusEl ? focusEl.focus() : console.log("No element to restore focus to after copy?");
            }, (_b = (_a = this._options) == null ? void 0 : _a.clipboardPasteDelay) != null ? _b : CLIPBOARD_PASTE_DELAY), typeof this._onCopySuccess == "function") {
              let rowCount = 0;
              ranges.length === 1 ? rowCount = ranges[0].toRow + 1 - ranges[0].fromRow : rowCount = ranges.length, this._onCopySuccess(rowCount);
            }
            return !1;
          }
        }
        if (!this._options.readOnlyMode && (e.which === this.keyCodes.V && (e.ctrlKey || e.metaKey) && !e.shiftKey || e.which === this.keyCodes.INSERT && e.shiftKey && !e.ctrlKey)) {
          let ta = this._createTextBox("");
          return setTimeout(() => this._decodeTabularData(this._grid, ta), 100), !1;
        }
      }
    }
    markCopySelection(ranges) {
      var _a;
      this.clearCopySelection();
      let columns = this._grid.getColumns(), hash = {};
      for (let i = 0; i < ranges.length; i++)
        for (let j = ranges[i].fromRow; j <= ranges[i].toRow; j++) {
          hash[j] = {};
          for (let k = ranges[i].fromCell; k <= ranges[i].toCell && k < columns.length; k++)
            hash[j][columns[k].id] = this._copiedCellStyle;
        }
      this._grid.setCellCssStyles(this._copiedCellStyleLayerKey, hash), clearTimeout(this._clearCopyTI), this._clearCopyTI = setTimeout(() => {
        this.clearCopySelection();
      }, ((_a = this._options) == null ? void 0 : _a.clearCopySelectionDelay) || CLEAR_COPY_SELECTION_DELAY);
    }
    clearCopySelection() {
      this._grid.removeCellCssStyles(this._copiedCellStyleLayerKey);
    }
    setIncludeHeaderWhenCopying(includeHeaderWhenCopying) {
      this._options.includeHeaderWhenCopying = includeHeaderWhenCopying;
    }
  };
  window.Slick && Utils.extend(!0, window, {
    Slick: {
      CellExternalCopyManager: SlickCellExternalCopyManager
    }
  });
})();
//# sourceMappingURL=slick.cellexternalcopymanager.js.map
