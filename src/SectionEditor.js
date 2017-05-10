import React, { Component } from 'react';
import PropTypes from 'prop-types';

import ContentEditor from './ContentEditor';

import './SectionEditor.scss';

export default class SectionEditor extends Component {
  static PropTypes = {
  }

  static defaultProps = {

  }

  constructor(props) {
    super(props);
  }

  render() {
    const {
      mainEditorState,
      notes,
      contextualizations,
      contextualizers,
      resources,
      lastInsertionType,
      
      onEditorChange,
      onNoteAdd,
      onDataChange,
      onContextualizationRequest,
      onContextualizationClick,
      onContextualizationMouseOver,
      onContextualizationMouseOut,
      onNotePointerMouseOver,
      onNotePointerMouseOut,
      onNotePointerMouseClick,
      
      inlineContextualizationComponents,
      blockContextualizationComponents,
      editorStyles,
    } = this.props;

    const renderNoteEditor = (noteId, order) => {
      const onThisNoteEditorChange = editor => onEditorChange('note', noteId, editor);
      const onNoteContextualizationRequest = (contextualizationRequestType, selection) => {
        onContextualizationRequest('note', noteId, contextualizationRequestType, selection);
      };
      const onClickDelete = () => {
        this.props.onNoteDelete(noteId);
      }
      const noteEditorState = notes[noteId].editorState;
      return (
        <section 
          key={noteId}
          className="note-container">
          <div className="note-header">
            <button onClick={onClickDelete}>x</button>
            <h3>Note {notes[noteId].order}</h3>
          </div>
          <div className="note-body">
            <ContentEditor 
              editorState={noteEditorState}
              contextualizations={contextualizations}
              contextualizers={contextualizers}
              resources={resources}
              lastInsertionType={lastInsertionType} 
              
              onEditorChange={onThisNoteEditorChange}
              onNoteAdd={onNoteAdd}
              onContextualizationRequest={onNoteContextualizationRequest}
              onDataChange={onDataChange}

              onContextualizationClick={onContextualizationClick}
              onContextualizationMouseOver={onContextualizationMouseOver}
              onContextualizationMouseOut={onContextualizationMouseOut}
              
              inlineContextualizationComponents={inlineContextualizationComponents}
              blockContextualizationComponents={blockContextualizationComponents}
              allowNotesInsertion={false}
              editorStyle={editorStyles.noteEditor}
            />
          </div>
        </section>
      );
    };

    const onMainEditorChange = editor => onEditorChange('main', undefined, editor);
    const onMainContextualizationRequest = (contextualizationRequestType, selection) => {
      onContextualizationRequest('main', undefined, contextualizationRequestType, selection);
    };
    return (
      <div className="SectionEditor">
        <aside className="notes-container">
          {
            Object.keys(notes || {})
            .sort((a, b) => {
              if (notes[a].order > notes[b].order) {
                return 1;
              } else return -1;
            })
            .map(renderNoteEditor)
          }
        </aside>
        <section className="main-container-editor">
          <ContentEditor 
            editorState={mainEditorState}
            notes={notes}
            contextualizations={contextualizations}
            contextualizers={contextualizers}
            resources={resources}
            lastInsertionType={lastInsertionType} 
            
            onEditorChange={onMainEditorChange}
            onContextualizationRequest={onMainContextualizationRequest}
            onNoteAdd={onNoteAdd}
            onDataChange={onDataChange}

            onContextualizationClick={onContextualizationClick}
            onContextualizationMouseOver={onContextualizationMouseOver}
            onContextualizationMouseOut={onContextualizationMouseOut}

            onNotePointerMouseOver={onNotePointerMouseOver}
            onNotePointerMouseOut={onNotePointerMouseOut}
            onNotePointerMouseClick={onNotePointerMouseClick}
            
            inlineContextualizationComponents={inlineContextualizationComponents}
            blockContextualizationComponents={blockContextualizationComponents}
            allowNotesInsertion={true}
            editorStyle={editorStyles.mainEditor}
          />
        </section>
      </div>
    );
  }
}