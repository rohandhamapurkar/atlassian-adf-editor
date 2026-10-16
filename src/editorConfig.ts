import type { EditorProps } from '@atlaskit/editor-core';

// Keep the standalone feature contract in one place, checked against the pinned API.
export const editorFeatures: Partial<EditorProps> = {
  allowRule: true,
  allowTextColor: true,
  allowTextAlignment: true,
  allowIndentation: true,
  showIndentationButtons: true,
  allowUndoRedoButtons: true,
  allowTables: {
    allowControls: true,
    allowHeaderRow: true,
    allowHeaderColumn: true,
    allowNumberColumn: true,
    allowColumnResizing: true,
    allowMergeCells: true,
    allowBackgroundColor: true,
    allowColumnSorting: true,
  },
  allowPanel: { allowCustomPanel: true, allowCustomPanelEdit: true },
  allowTasksAndDecisions: true,
  allowNestedTasks: true,
  allowDate: true,
  allowStatus: true,
  allowExpand: { allowInsertion: true, allowInteractiveExpand: true },
  allowFindReplace: true,
  allowHelpDialog: true,
  quickInsert: true,
};
