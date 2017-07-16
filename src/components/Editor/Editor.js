import React, { Component } from 'react';
import PropTypes from 'prop-types';

import {
  EditorState
} from 'draft-js';

import BasicEditor from '../BasicEditor/BasicEditor';
import DefaultNoteContainer from '../NoteContainer/NoteContainer';

import './Editor.scss';

export default class Editor extends Component {

  static propTypes = {
    mainEditorState: PropTypes.object,
    notes: PropTypes.object,
    assets: PropTypes.object,

    editorClass: PropTypes.string,
    
    onEditorChange: PropTypes.func,
    onNoteAdd: PropTypes.func,

    onAssetChange: PropTypes.func,
    onAssetRequest: PropTypes.func,
    onAssetRequestCancel: PropTypes.func,
    onAssetChoice: PropTypes.func,
    onAssetClick: PropTypes.func,
    onAssetMouseOver: PropTypes.func,
    onAssetMouseOut: PropTypes.func,

    onNotePointerMouseOver: PropTypes.func,
    onNotePointerMouseOut: PropTypes.func,
    onNotePointerMouseClick: PropTypes.func,
    onNoteDelete: PropTypes.func,
    onDrop: PropTypes.func,
    onDragOver: PropTypes.func,
    onClick: PropTypes.func,
    onBlur: PropTypes.func,

    assetRequestPosition: PropTypes.object,
    assetChoiceProps: PropTypes.object,
    
    inlineAssetComponents: PropTypes.object,
    blockAssetComponents: PropTypes.object,
    AssetChoiceComponent: PropTypes.func,
    NotePointerComponent: PropTypes.func,
    iconMap: PropTypes.object,

    keyBindingFn: PropTypes.func,

    editorStyles: PropTypes.object,
    clipboard: PropTypes.object,
    focusedEditorId: PropTypes.string,
    NoteContainerComponent: PropTypes.func,
  }

  constructor(props) {
    super(props);

    this.notes = {};
  }

  focus = (contentId, selection) => {
    if (contentId === 'main' && this.mainEditor) {
      if (selection) {
        this.mainEditor.setState({
          editorState: EditorState.acceptSelection(
            this.mainEditor.state.editorState,
            selection
          )
        });
      }
      setTimeout(() => this.mainEditor.focus());
    } else if (this.notes[contentId]) {
      setTimeout(() => this.notes[contentId].editor.focus());
      if (selection) {
        this.notes[contentId].editor.setState({
          editorState: EditorState.acceptSelection(
            this.notes[contentId].editor.state.editorState,
            selection
          )
        });
      }
    }
  }

  generateEmptyEditor = () => {
    if (this.mainEditor) {
      return this.mainEditor.generateEmptyEditor();
    }
    return null;
  }

  render() {
    const {
      mainEditorState,
      notes,
      assets,

      editorClass = 'scholar-draft-SectionEditor',
      
      onEditorChange,
      onNoteAdd,

      onAssetChange,
      onAssetRequest,
      onAssetRequestCancel,
      onAssetChoice,
      onAssetClick,
      onAssetMouseOver,
      onAssetMouseOut,

      onNotePointerMouseOver,
      onNotePointerMouseOut,
      onNotePointerMouseClick,
      onNoteDelete,
      onDrop,
      onDragOver,
      onClick,
      onBlur,

      assetRequestPosition,
      assetChoiceProps,
      
      inlineAssetComponents,
      blockAssetComponents,
      AssetChoiceComponent,
      NotePointerComponent,
      iconMap,

      keyBindingFn,

      editorStyles,
      clipboard,
      focusedEditorId,
      NoteContainerComponent,
    } = this.props;

    const bindMainEditor = (editor) => {
      this.mainEditor = editor;
    };

    const renderNoteEditor = (noteId, order) => {
      const onThisNoteEditorChange = editor => onEditorChange(noteId, editor);
      const onNoteAssetRequest = (selection) => {
        onAssetRequest(noteId, selection);
      };
      const onClickDelete = () => {
        if (typeof onNoteDelete === 'function') {
          this.props.onNoteDelete(noteId);
        }
      };
      const onNoteDrop = (payload, selection) => {
        if (typeof onDrop === 'function') {
          onDrop(noteId, payload, selection);
        }
      };
      const onNoteDragOver = (event) => {
        if (typeof onDragOver === 'function') {
          onDragOver(noteId, event);
        }
      };
      const note = notes[noteId];

      const onNoteEditorClick = (event) => {
        if (typeof onClick === 'function') {
          onClick(event, noteId);
        }
      };
      const bindNote = (thatNote) => {
        this.notes[noteId] = thatNote;
      };
      const onNoteBlur = (event) => {
        onBlur(event, noteId);
      };

      const NoteContainer = NoteContainerComponent || DefaultNoteContainer;
      return (
        <NoteContainer
          key={noteId}
          note={note}
          notes={notes}
          assets={assets}

          ref={bindNote}

          contentId={noteId}

          assetRequestPosition={assetRequestPosition}
          assetChoiceProps={assetChoiceProps}

          isActive={noteId === focusedEditorId}

          onEditorClick={onNoteEditorClick}
          onBlur={onNoteBlur}

          onEditorChange={onThisNoteEditorChange}

          onAssetRequest={onNoteAssetRequest}
          onAssetRequestCancel={onAssetRequestCancel}
          onAssetChange={onAssetChange}
          onAssetChoice={onAssetChoice}

          clipboard={clipboard}

          onDrop={onNoteDrop}
          onDragOver={onNoteDragOver}
          onClickDelete={onClickDelete}

          onAssetClick={onAssetClick}
          onAssetMouseOver={onAssetMouseOver}
          onAssetMouseOut={onAssetMouseOut}

          inlineAssetComponents={inlineAssetComponents}
          blockAssetComponents={blockAssetComponents}
          AssetChoiceComponent={AssetChoiceComponent}
          iconMap={iconMap}
          keyBindingFn={keyBindingFn}

          editorStyle={editorStyles && editorStyles.noteEditor}
        />
      );
    };

    const onMainEditorChange = editor => onEditorChange('main', editor);
    const onMainAssetRequest = (selection) => {
      onAssetRequest('main', selection);
    };

    const onMainEditorDrop = (payload, selection) => {
      if (typeof onDrop === 'function') {
        onDrop('main', payload, selection);
      }
    };

    const onMainDragOver = (event) => {
      if (typeof onDragOver === 'function') {
        onDragOver('main', event);
      }
    };

    const onMainEditorClick = (event) => {
      if (typeof onClick === 'function') {
        onClick(event, 'main');
      }
    };
    const onMainBlur = (event) => {
      onBlur(event, 'main');
    };
    return (
      <div className={editorClass}>
        <section className="main-container-editor">
          <BasicEditor 
            editorState={mainEditorState}
            assets={assets}
            ref={bindMainEditor}

            notes={notes}

            contentId="main"

            assetRequestPosition={assetRequestPosition}
            assetChoiceProps={assetChoiceProps}

            isActive={focusedEditorId === 'main'}

            onClick={onMainEditorClick}
            onBlur={onMainBlur}
            
            onEditorChange={onMainEditorChange}
            onDragOver={onMainDragOver}
            onDrop={onMainEditorDrop}
            onAssetRequest={onMainAssetRequest}
            onAssetRequestCancel={onAssetRequestCancel}
            onAssetChoice={onAssetChoice}

            onNoteAdd={onNoteAdd}
            onAssetChange={onAssetChange}

            onAssetClick={onAssetClick}
            onAssetMouseOver={onAssetMouseOver}
            onAssetMouseOut={onAssetMouseOut}

            onNotePointerMouseOver={onNotePointerMouseOver}
            onNotePointerMouseOut={onNotePointerMouseOut}
            onNotePointerMouseClick={onNotePointerMouseClick}
            
            inlineAssetComponents={inlineAssetComponents}
            blockAssetComponents={blockAssetComponents}
            AssetChoiceComponent={AssetChoiceComponent}
            NotePointerComponent={NotePointerComponent}
            iconMap={iconMap}

            clipboard={clipboard}

            allowNotesInsertion
            editorStyle={editorStyles && editorStyles.mainEditor}
          />
        </section>
        <aside className="notes-container">
          {
            Object.keys(notes || {})
            .sort((first, second) => {
              if (notes[first].order > notes[second].order) {
                return 1;
              } return -1;
            })
            .map(renderNoteEditor)
          }
        </aside>
      </div>
    );
  }
}
