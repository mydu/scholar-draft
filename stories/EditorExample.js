import React, { Component } from 'react';
import PropTypes from 'prop-types';

import {debounce} from 'lodash';

import {mapSeries} from 'async';

import {Map} from 'immutable';
import {
  EditorState,
  ContentState,
  CharacterMetadata,
  Modifier,
  Entity,
  AtomicBlockUtils,
  convertToRaw,
  convertFromRaw
} from 'draft-js';

import {
  getSelectedBlocksList
} from 'draftjs-utils';

import {
  v4 as generateId
} from 'uuid';

import Editor, {
  utils,
  constants
} from '../src';
const {
  NOTE_POINTER,
  INLINE_ASSET
} = constants;

const {
  getAssetsToDeleteFromEditor,
  insertAssetInEditor,
  deleteAssetFromEditor,
  deleteNoteFromEditor,
  getUsedAssets,
  getUnusedAssets,
  updateNotesFromEditor,
  insertNoteInEditor,
  updateAssetsFromEditors,
  insertFragment
} = utils;

import ExampleBlockCitation from './ExampleBlockCitation';
import ExampleInlineCitation from './ExampleInlineCitation';
import ExampleBlockAssetChoice from './ExampleBlockAssetChoice';

const inlineAssetComponents = {
  citation: ExampleInlineCitation
};

const blockAssetComponents = {
  citation: ExampleBlockCitation
};

export default class EditorExample extends Component {
  
  state = {
    // mock related
    assetRequest: false,
    assetRequestType: undefined,
    // all these should be handled by upstream logic in real applications
    mainEditorState: EditorState.createEmpty(),
    notes: {},
    inlineAssetComponents,
    blockAssetComponents,
    contextualizations: {
    },
    resources: {
      [generateId()]: {
        title: 'My nice resource',
        authors: [
          {
            firstName: 'Mickey',
            lastName: 'Rourque'
          }
        ]
      }
    },
    contextualizers: {
      [generateId()]: {
        type: 'citation',
        pages: '12-13'
      }
    },
    readOnly: {
      main: false
    }
  }


  constructor(props) {
    super(props);
    this.debouncedCleanStuffFromEditorInspection = debounce(this.cleanStuffFromEditorInspection, 1000);
  }

  componentDidMount = () => {
    document.addEventListener('copy', this.onCopy);
    document.addEventListener('cut', this.onCopy);
    document.addEventListener('paste', this.onPaste);
  }

  componentWillUnmount = () => {
    document.removeEventListener('copy', this.onCopy);
    document.removeEventListener('cut', this.onCopy);
    document.removeEventListener('paste', this.onPaste);
  }

  updateNotesFromEditor = () => {
    const notes = updateNotesFromEditor(this.state.mainEditorState, this.state.notes);
    this.setState({
      notes
    });
  }

  cleanStuffFromEditorInspection = () => {
    // this.clearContextualizations();
    this.updateNotesFromEditor();
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.mainEditorState !== prevState.mainEditorState) {
      this.debouncedCleanStuffFromEditorInspection();
    }
  }

  /**
   * Prepares data for later pasting 
   */
  onCopy = e => {
    // we store entities data as a js object in order to reinject them in editor states later one
    const copiedEntities = {};
    const copiedNotes = [];
    // this is for mock purpose and dependent to the asset model
    const copiedContextualizers = [];
    const copiedContextualizations = [];



    let clipboard = null;
    let currentContent;
    let editorState;
    let activeId;
    const stateDiff = {};


    const {
      readOnly
    } = this.state;
    // case: data is copied from the main editor
    if (!readOnly.main) {
      clipboard = this.editor.mainEditor.editor.getClipboard();
      editorState = this.state.mainEditorState;
    // case: data is copied from a note
    } else {
      activeId = Object.keys(this.state.notes)
        .find(id => !readOnly[id]);
      editorState = this.state.notes[activeId].editorState;
      clipboard = this.editor.notes[activeId].editor.getClipboard();
    }
    // todo : this is bad, due to problems with readonly management
    if (!activeId) {
      activeId = 'main';
    }
    // bootstrapping the list of copied entities accross editors
    copiedEntities[activeId] = [];
    currentContent = editorState.getCurrentContent();
    const selectedBlocksList = getSelectedBlocksList(editorState);

    stateDiff.clipboard = clipboard;

    selectedBlocksList.forEach(contentBlock => {
      const block = contentBlock.toJS();
      const entitiesIds = block.characterList.filter(char => char.entity).map(char => char.entity);
      let entity;
      let eData;
      entitiesIds.forEach(entityKey => {
        entity = currentContent.getEntity(entityKey);
        eData = entity.toJS();
        copiedEntities[activeId].push({
          key: entityKey,
          entity: eData
        });
        const type = eData.type;
        // copying note pointer and note
        if (type === NOTE_POINTER) {
          const noteId = eData.data.noteId;
          const noteContent = this.state.notes[noteId].editorState.getCurrentContent();
          const rawContent = convertToRaw(noteContent);
          copiedEntities[noteId] = [];
          copiedNotes.push({
            id: noteId,
            // ...this.state.notes[noteId],
            rawContent
          });
          // copying note's entities
          noteContent.getBlockMap().forEach(block => {
            block.getCharacterList().map(char => {
              if (char.entity) {
                entityKey = char.entity;
                entity = currentContent.getEntity(entityKey);
                eData = entity.toJS();
                copiedEntities[noteId].push({
                  key: entityKey,
                  entity: eData
                });
              }
            })
            return true;
          });
        // copying asset pointer
        } else {
          // mock
          const assetId = entity.data.asset.id;
          const contextualization = this.state.contextualizations[assetId];
          copiedContextualizations.push({...contextualization});
          copiedContextualizers.push({
            ...this.state.contextualizers[contextualization.contextualizerId],
            id: contextualization.contextualizerId
          });
        }
      });
      return true;
    });


    const copiedData = {
      copiedEntities,
      copiedContextualizations,
      copiedContextualizers,
      copiedNotes
    };

    e.clipboardData.setData('text/plain', '$$$scholar-draft-clipboard');

    stateDiff.copiedData = copiedData;
    this.setState(stateDiff);
    e.preventDefault();
  }

  onPaste = e => {

    const {
      readOnly, // will be used to define with which editorState to work
      clipboard, // blockMap of the data copied to clipboard
      copiedData // model-dependent set of data objects saved to clipboard
    } = this.state;

    // console.log('clipboard text', e.clipboardData.getData('text/plain'), 'clipboard', clipboard);

    // this hack allows to check if data comes from out of the editor
    if (!clipboard || e.clipboardData.getData('text/plain') !== '$$$scholar-draft-clipboard') {
      this.setState({
        clipboard: null,
        copiedData: null
      });
      return;
    } else {
      e.preventDefault();
    }

    let editorState;
    let activeId;
    let newClipboard = clipboard;// clipboard entities will be updated

    // defining the relevant editor state to work with
    // (todo: this is badly done - an "activeEditorState" prop would be better)
    if (!readOnly.main) {
      activeId = 'main';
      editorState = this.state.mainEditorState;
    } else {
      activeId = Object.keys(this.state.notes)
        .find(id => !readOnly[id]);
      editorState = this.state.notes[activeId].editorState;
    }

    const currentContent = editorState.getCurrentContent();
    const stateMods = {
      mainEditorState: this.state.mainEditorState,
      notes: {...this.state.notes},
      contextualizers: {...this.state.contextualizers},
      contextualizations: {...this.state.contextualizations},
      resources: {...this.state.resources}
    };
    let newEditorState = editorState;
    // console.log('start', copiedData.copiedEntities);
    // console.log('state notes', this.state.notes);
    // let firstBlock = newEditorState.getCurrentContent().toJS().blockMap[Object.keys(newEditorState.getCurrentContent().toJS().blockMap)[0]];
    // let firstEntityId = firstBlock.characterList[0].entity;
    // console.log('first entity key', firstEntityId);
    // console.log('first entity', newEditorState.getCurrentContent().getEntity(firstEntityId).toJS().data.noteId);
    

    // case: some non-textual data has been saved to the clipboard
    if (typeof copiedData === 'object') {
        const data = copiedData;
        // past assets/contextualizations (attributing them a new id)
        if (data.copiedContextualizations) {
          stateMods.contextualizations = data.copiedContextualizations.reduce((result, contextualization) => {
            const id = generateId();
            return {
              ...result,
              [id]: {
                ...contextualization,
                oldId: contextualization.id,
                id
              }
            }
          }, {...this.state.contextualizations});
        }
        // ensure all necessary data is there
        // if (data.copiedContextualizers) {
        //   stateMods.contextualizers = data.copiedContextualizers.reduce((result, contextualizer) => {
        //     return {
        //       ...result,
        //       [contextualizer.id]: contextualizer
        //     }
        //   }, {...this.state.contextualizer});
        // }
        // paste notes (attributing them a new id)
        if (data.copiedNotes) {
          stateMods.notes = {
            ...stateMods.notes,
            ...data.copiedNotes.reduce((result, note) => {
              const id = generateId();
              const noteEditorState = EditorState.createWithContent(convertFromRaw(note.rawContent));
              // console.log('new note id', id);
              return {
                ...result,
                [id]: {
                  ...note,
                  editorState: noteEditorState,
                  oldId: note.id,
                  id
                }
              };
            }, {...stateMods.notes})
          }
        }
        // console.log('notes modified');
        // let firstBlock = newEditorState.getCurrentContent().toJS().blockMap[Object.keys(newEditorState.getCurrentContent().toJS().blockMap)[0]];
        // let firstEntityId = firstBlock.characterList[0].entity;
        // console.log('first entity key', firstEntityId);
        // console.log('first entity', newEditorState.getCurrentContent().getEntity(firstEntityId).toJS().data.noteId);
         
        // integrate new draftjs entities in respective editorStates
        if (Object.keys(data.copiedEntities).length) {
          // update entities data with correct notes and contextualizations ids pointers
          const copiedEntities = Object.keys(data.copiedEntities).reduce((result, contentId) => {
            return {
              ...result,
              [contentId]: data.copiedEntities[contentId].map(inputEntity => {
                // console.log('input entity', inputEntity);
                const entity = {...inputEntity};
                const data = entity.entity.data;
                if (data && data.noteId) {
                  const id = Object.keys(stateMods.notes).find(key => {
                    if (stateMods.notes[key].oldId === data.noteId) {
                      return true;
                    }
                  });
                  // console.log('attributing note id', id);
                  if (id) {
                    return {
                      ...entity,
                      entity: {
                        ...entity.entity,
                        data: {
                          ...entity.entity.data,
                          noteId: id
                        }
                      }
                    }
                  }
                } else if (data.asset && data.asset.id) {
                  const id = Object.keys(stateMods.contextualizations).find(key => {
                    if (stateMods.contextualizations[key].oldId === data.asset.id) {
                      return true;
                    }
                  });
                  if (id) {
                    return {
                      ...entity,
                      entity: {
                        ...entity.entity,
                        data: {
                          ...entity.entity.data,
                          asset: {
                            ...entity.entity.data.asset,
                            id
                          }
                        }
                      }
                    }
                  }
                }
                return entity;
              })
            };
          }, {});
          // console.log('will add entities');
          // let firstBlock = newEditorState.getCurrentContent().toJS().blockMap[Object.keys(newEditorState.getCurrentContent().toJS().blockMap)[0]];
          // let firstEntityId = firstBlock.characterList[0].entity;
          // console.log('first entity key', firstEntityId);
          // console.log('first entity', newEditorState.getCurrentContent().getEntity(firstEntityId).toJS().data.noteId);
           
          let newContentState;
          // iterating through the entities and adding them to the new editor state
          Object.keys(copiedEntities).forEach(contentId => {
            if (contentId === 'main') {
              copiedEntities[contentId].forEach(entity => {
                const editor = stateMods.mainEditorState;
                newContentState = editor.getCurrentContent();
                // console.log('will create entity', entity.entity);
                newContentState = newContentState.createEntity(entity.entity.type, entity.entity.mutability, {...entity.entity.data});
                stateMods.mainEditorState = EditorState.push(
                  newEditorState,
                  newContentState,
                  'create-entity'
                );
                const newEntityKey = newContentState.getLastCreatedEntityKey();
                // console.log('last created entity', newContentState.getEntity(newEntityKey).toJS());
                // console.log('must replace in fragment key %s with %s', entity.key, newEntityKey);
                newClipboard = clipboard.map(block => {
                  const characters = block.getCharacterList();
                  const newCharacters = characters.map(char => {
                    if (char.getEntity() && char.getEntity() === entity.key) {
                      // console.log('ok');
                      return CharacterMetadata.applyEntity(char, newEntityKey);
                    }
                    return char;
                  })
                  return block.set('characterList', newCharacters) // block;
                });
                // console.log('last created entity', newContentState.getEntity(newEntityKey).toJS());
              });
            } else {
              copiedEntities[contentId].forEach(entity => {
                const editor = stateMods.notes[contentId].editorState;
                newContentState = editor.getCurrentContent();
                newContentState = newContentState.createEntity(entity.entity);
                
                stateMods.notes[contentId].editorState = EditorState.push(
                  newEditorState,
                  newContentState,
                  'create-entity'
                );
                const newEntityKey = newContentState.getLastCreatedEntityKey();
                // console.log('last created entity', newContentState.getEntity(newEntityKey).toJS());
                // console.log('must replace in fragment key %s with %s', entity.key, newEntityKey);
                newClipboard = clipboard.map(block => {
                  const characters = block.getCharacterList();
                  const newCharacters = characters.map(char => {
                    if (char.getEntity() && char.getEntity() === entity.key) {
                      // console.log('ok');
                      return CharacterMetadata.applyEntity(char, newEntityKey);
                    }
                    return char;
                  })
                  return block.set('characterList', newCharacters) // block;
                });
              });
            }
          });
        }
    }

    // console.log('did create entities');
    // firstBlock = newEditorState.getCurrentContent().toJS().blockMap[Object.keys(newEditorState.getCurrentContent().toJS().blockMap)[0]];
    // firstEntityId = firstBlock.characterList[0].entity;
    // console.log('first entity key', firstEntityId);
    // console.log('first entity', newEditorState.getCurrentContent().getEntity(firstEntityId).toJS().data.noteId);
     

    newEditorState = insertFragment(newEditorState, newClipboard);
    
    if (activeId === 'main') {
      stateMods.mainEditorState = newEditorState;
      // console.log('before cleaning notes', stateMods.notes);
      // console.log('state before', newEditorState.getCurrentContent().toJS().blockMap);
      stateMods.notes = updateNotesFromEditor(stateMods.mainEditorState, stateMods.notes);
      // console.log('after cleaning notes', stateMods.notes);
    } else {
      stateMods.notes = {
        ...this.state.notes,
        [activeId]: {
          ...this.state.notes[activeId],
          editorState: newEditorState
        }
      }
    }
    stateMods.notes = Object.keys(stateMods.notes).reduce((result, noteId) => {
      const note = stateMods.notes[noteId];
      delete note.oldId;
      return {
        ...result,
        [noteId]: note
      };
    }, {});
    stateMods.contextualizations = Object.keys(stateMods.contextualizations).reduce((result, cId) => {
      const cont = stateMods.contextualizations[cId];
      delete cont.oldId;
      return {
        ...result,
        [cId]: cont
      };
    }, {});
    if (Object.keys(stateMods).length) {
      this.setState(stateMods);
    }
  }

  clearContextualizations = () => {
    const notesEditorStates = Object.keys(this.state.notes).reduce((result, noteId) => {
      return {
        ...result,
        [noteId]: this.state.notes[noteId].editorState
      } 
    }, {});
    let editorStates = {
      'main': this.state.mainEditorState,
      ...notesEditorStates,
    };
    editorStates = Object.keys(editorStates).map(id => editorStates[id]).filter(e => e);
    const contextualizations = updateAssetsFromEditors(editorStates, {...this.state.contextualizations});
    this.setState({
      contextualizations
    });
  }

  onEditorChange = (contentType, noteId, editorState) => {
    // list all editor states to purge unused assets
    if (contentType === 'main') {
      this.setState({
        mainEditorState: editorState,
        // notes
      });
    } else {
      this.setState({
        notes: {
            ...this.state.notes,
            [noteId]: {
              ...this.state.notes[noteId],
              editorState
            }
          }
      });
    }
  }

  onAssetRequest = (contentType, noteId, selection) => {

    this.setState({
      readOnly: {
        ...this.state.readOnly,
        [noteId || 'main']: false
      }
    });

    setTimeout(() => {
      this.setState({
        assetRequest: true,
        assetRequestSelection: selection,
        assetRequestContentId: contentType === 'main' ? 'main' : noteId,
        readOnly: {
          ...this.state.readOnly,
          [noteId || 'main']: true
        }
      });
      this.editor.focus(noteId || 'main');

    }, 1);
  }

  onAssetChoice = () => {
    this.insertContextualization();
  }

  onAssetRequestCancel = () => {
    this.setState({
      assetRequest: undefined,
      assetRequestSelection: undefined,
      readOnly: {}
    });
  }

  /*
   * MOCK-RELATED
   */

  onAssetMouseClick = (contextualizationId, contextualizationData, event) => {
    // console.info('on contextualization mouse click', contextualizationId, contextualizationData, event);
  }

  onAssetMouseOver = (contextualizationId, contextualizationData, event) => {
    // console.info('on contextualization mouse over', contextualizationId, contextualizationData, event);
  }

  onAssetMouseOut = (contextualizationId, contextualizationData, event) => {
    // console.info('on contextualization mouse out', contextualizationId, contextualizationData, event);
  }

  onNotePointerMouseOver = (noteId, event) => {
    // console.info('on note pointer mouse over', noteId, event);
  }

  onNotePointerMouseOut = (noteId, event) => {
    // console.info('on note pointer mouse out', noteId, event);
  }

  onNotePointerMouseClick = (noteId, event) => {
    // console.info('on note pointer mouse click', noteId, event);
  }

  insertContextualization = (contentId, inputEditorState) => {
    const {
      mainEditorState,
      notes,
      assetRequestSelection,
      resources,
      contextualizers,
      contextualizations
    } = this.state;

    const assetRequestContentId = contentId || this.state.assetRequestContentId;
    const id = generateId();
    const contextualization = {
      id,
      resourceId: Object.keys(resources)[0],
      contextualizerId: Object.keys(contextualizers)[0],
      type: Object.keys(contextualizers).length ? contextualizers[Object.keys(contextualizers)[0]].type : INLINE_ASSET,
    };
    let editorState = inputEditorState;
    if (!editorState){
      editorState = assetRequestContentId === 'main' ? mainEditorState : notes[assetRequestContentId].editorState;
    }
    const newEditorState = insertAssetInEditor(editorState, {id: contextualization.id}, assetRequestSelection);
    const newState = {
      assetRequest: false,
      assetRequestType: undefined,
      assetRequestSelection: undefined,
      contextualizations: {
        ...contextualizations,
        [id]: contextualization
      },
      notes: this.state.notes,
      readOnly: {
        ...this.state.readOnly,
        [assetRequestContentId]: true
      }
      // editorState: newEditorState,
    };
    if (assetRequestContentId === 'main') {
      newState.mainEditorState = newEditorState;
    } else {
      newState.notes[assetRequestContentId].editorState = newEditorState;
    }
    this.setState(newState);
    setTimeout(() => {
      this.setState({
        readOnly: {
          ...this.state.readOnly,
          [assetRequestContentId]: false
        }
      })
    });
  }

  updateResourceTitle = title => {
    this.setState({
      resources: {
        ...this.state.resources,
        [Object.keys(this.state.resources)[0]] : {
          ...this.state.resources[Object.keys(this.state.resources)[0]],
          title 
        }
      }
    })
  }

  updateContextualizerPages = pages => {
    this.setState({
      contextualizers: {
        ...this.state.contextualizers,
        [Object.keys(this.state.contextualizers)[0]] : {
          ...this.state.contextualizers[Object.keys(this.state.contextualizers)[0]],
          pages
        }
      }
    })
  }

  onDataChange = (dataProp, id, newObject) => {
    this.setState({
      [dataProp]: {
        ...this.state[dataProp],
        [id]: newObject
      }
    });
  }

  deleteContextualizations = ids => {
    const contextualizations = {...this.state.contextualizations};
    ids.forEach(id => {
      delete contextualizations[id]
    });
    return contextualizations;
  }

  deleteContextualization = (id) => {
    const contextualizations = {...this.state.contextualizations};
    let notes = this.state.notes;
    deleteAssetFromEditor(this.state.mainEditorState, id, newEditorState => {
      mapSeries(notes, (note, cb) => {
        deleteAssetFromEditor(note.editorState, id, newNoteEditorState => {
          cb(null, {
            ...note,
            id: note.id,
            editorState: newNoteEditorState
          });
        });
      }, (err, finalNotes) => {
        delete contextualizations[id];
        notes = finalNotes.reduce((final, note) => ({
          ...final,
          [note.id]: note
        }), {});
        this.setState({
          mainEditorState: newEditorState,
          notes,
          contextualizations
        });
      });
    });
  }

  /**
   * Deletes from state contextualizations not used inside the editor
   */
  refreshContextualizationsList = () => {
    const contextualizations = {...this.state.contextualizations};
    // in main
    let used = getUsedAssets(this.state.mainEditorState, contextualizations);
    // in notes
    Object.keys(this.state.notes)
    .forEach(noteId => {
      const noteEditor = this.state.notes[noteId].editorState;
      used = used.concat(getUsedAssets(noteEditor, contextualizations))
    });
    const unusedAssets = Object.keys(contextualizations).filter(id => used.indexOf(id) === -1);
    unusedAssets.forEach(id => {
      delete contextualizations[id];
    });
    this.setState({
      contextualizations
    });
  }

  addNote = () => {
    const id = generateId();
    // add related entity in main editor
    const mainEditorState = insertNoteInEditor(this.state.mainEditorState, id);
    // add note
    let notes = {
      ...this.state.notes,
      [id]: {
        id,
        editorState: EditorState.createEmpty()
      }
    };
    notes = updateNotesFromEditor(mainEditorState, notes);
    this.setState({
      notes,
      mainEditorState,
      readOnly: {
        ...this.state.readOnly,
        'main': true,
        [id]: false
      }
    });

    setTimeout(() => {
      this.editor.focus(id);
    }, 100);
  }

  deleteNote = id => {
    // remove related entity in main editor
    deleteNoteFromEditor(this.state.mainEditorState, id, mainEditorState => {
      // remove note
      const notes = this.state.notes;
      delete notes[id];
      this.setState({
        mainEditorState,
        notes,
        readOnly: {
          ...this.state.readOnly,
          main: false
        }
      });
    });
    this.editor.focus('main');
  }

  addTextAtCurrentSelection = (text) => {
    const contentId = this.state.assetRequestContentId;
    const editorState = contentId === 'main' ? this.state.mainEditorState : this.state.notes[contentId].editorState;

    const newContentState = Modifier.insertText(
      editorState.getCurrentContent(),
      editorState.getSelection(),
      text,
    );
    if (contentId === 'main') {
      this.setState({
        mainEditorState: EditorState.push(
          this.state.mainEditorState,
          newContentState,
          'insert-text'
        )
      });
    } else {
      this.setState({
        notes: {
          ...this.state.notes,
          [contentId]: {
            ...this.state.notes[contentId],
            editorState: EditorState.push(
              this.state.notes[contentId].editorState,
              newContentState,
              'insert-text'
            )
          }
        }
      });
    }
  }

  render = () => {
    const {
      onEditorChange,
      onAssetRequest,

      onAssetClick,
      onAssetMouseOver,
      onAssetMouseOut,
      onAssetRequestCancel,
      onAssetChoice,

      onNotePointerMouseOver,
      onNotePointerMouseOut,
      onNotePointerMouseClick,

      insertContextualization,
      updateContextualizerPages,
      updateResourceTitle,
      onDataChange,
      deleteContextualization,
      refreshContextualizationsList,
      addNote,
      deleteNote,
      addTextAtCurrentSelection,
      state
    } = this;

    const {
      mainEditorState,
      clipboard,
      notes,
      inlineAssetComponents,
      blockAssetComponents,
      contextualizations,
      contextualizers,
      assetRequest,
      assetRequestContentId,
      resources,
      readOnly,
    } = state;

    const onResourceTitleChange = e => {
      updateResourceTitle(e.target.value);
    }

    const onContextualizerPagesChange = e => {
      updateContextualizerPages(e.target.value);
    }
    const refreshUpstreamContextualizationsList = e => {
      refreshContextualizationsList();
    }

    const startDrag = (e) => {
       e.dataTransfer.dropEffect = 'copy';
       e.dataTransfer.setData('text', 'TEST');
       this.setState({
        readOnly: {}
       });
    };

    const onDrop = (contentId, payload, selection) => {
      const editorState = contentId === 'main' ? this.state.mainEditorState : this.state.notes[contentId].editorState;
      this.insertContextualization(contentId, EditorState.acceptSelection(editorState, selection));
    };

    const onClick = (event, contentId = 'main') => {
      // console.log('on click', this.state.readOnly[contentId]);
      if (this.state.readOnly[contentId]) {
        // console.log('set readonly to false for', contentId);
        this.setState({
          readOnly: {
            ...this.state.readOnly,
            [contentId]: false
          }
        });
        setTimeout(() => {
          this.editor.focus(contentId);
        }, 1);
      }
    }

    const onBlur = (event, contentId = 'main') => {
      this.setState({
        readOnly: {
          ...this.state.readOnly,
          [contentId]: true
        }
      });
    };

    // console.log(Object.keys(contextualizers));

    const assets = Object.keys(contextualizations)
    .reduce((ass, id) => {
      const contextualization = contextualizations[id];
      const contextualizer = contextualizers[contextualization.contextualizerId]
      return {
        ...ass,
        [id]: {
          ...contextualization,
          resource: resources[contextualization.resourceId],
          contextualizer: contextualizer,
          type: contextualizer ? contextualizer.type : INLINE_ASSET
        }
      }
    }, {});

    const assetChoiceProps = {
      options: ['asset 1', 'asset 2', 'asset 3'],
      addPlainText: (text) => {
        addTextAtCurrentSelection(text);
        onAssetRequestCancel();
      }
    };
    let assetRequestPosition;
    if (assetRequest) {
      if (assetRequestContentId === 'main') {
        assetRequestPosition = mainEditorState.getSelection();
      } else if(assetRequestContentId && notes[assetRequestContentId]) {
        assetRequestPosition = notes[assetRequestContentId].editorState.getSelection();
      }
    }

    const bindRef = editor => {
      this.editor = editor;
    }

    const onScroll = e => {
      if (this.editor && !this.state.readOnly['main']) {
        this.editor.mainEditor.updateSelection();
      }
      if (this.editor.notes) {
        Object.keys(this.editor.notes)
        .filter(noteId => !this.state.readOnly[noteId])
        .forEach(noteId => {
          if (this.editor.notes[noteId]) {
            this.editor.notes[noteId].editor.updateSelection();
          }
        });
      }
   }
    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'fixed',
            padding: '1rem',
            left: 0,
            top: 0,
            width: '10%',
            height: '100%',
            zIndex: 3,
            overflow: 'auto'
          }}
        >
          {assetRequest && <div>
          <button onClick={() => insertContextualization()}>Insert contextualization</button>
            </div>}
          <div
            draggable={true} 
            onDragStart={startDrag}
            style={{
              border: '1px solid black',
              background: 'white'
            }}
          >
            Draggable resource
          </div>
          {
            Object.keys(contextualizations)
            .map(key => {
              const onClick = () => deleteContextualization(key);
              return (
                <div key={key}>
                  <button
                    onClick={onClick}
                  >
                    Delete contextualization {key}
                  </button>
                </div>
              );
            })
          }
          <div>
          {Object.keys(contextualizations).length > 0 && <div>
            <button onClick={refreshUpstreamContextualizationsList}>Refresh upstream contextualizations list</button>
          </div>}
            Change the contextualizer page :
            <input
              value={Object.keys(contextualizers).length ? contextualizers[Object.keys(contextualizers)[0]].pages: ''}
              onChange={onContextualizerPagesChange}
            >
            </input>
          </div>
          <div>
            Change the contextualizer title :
            <input
              value={Object.keys(resources).length ? resources[Object.keys(resources)[0]].title: 0}
              onChange={onResourceTitleChange}
            >
            </input>
          </div>
        </div>
          
        <div
          onScroll={onScroll}
          style={{
            position: 'relative',
            top: '0',
            left: '20%',
            height: '100%',
            width: '80%',
            overflow: 'auto'
          }}>
          <Editor 
            mainEditorState={mainEditorState}
            notes={notes}
            assets={assets}

            clipboard={clipboard}

            ref={bindRef}

            readOnly={readOnly}

            contextualizations={contextualizations}
            contextualizers={contextualizers}
            resources={resources}
                        
            onEditorChange={onEditorChange}

            onDrop={onDrop}
            onClick={onClick}
            onBlur={onBlur}

            onAssetClick={onAssetClick}
            onAssetMouseOver={onAssetMouseOver}
            onAssetMouseOut={onAssetMouseOut}
            onAssetRequest={onAssetRequest}
            onAssetChange={onDataChange}
            onAssetRequestCancel={onAssetRequestCancel}
            onAssetChoice={onAssetChoice}

            onNoteAdd={addNote}
            onNoteDelete={deleteNote}

            onNotePointerMouseOver={onNotePointerMouseOver}
            onNotePointerMouseOut={onNotePointerMouseOut}
            onNotePointerMouseClick={onNotePointerMouseClick}

            assetRequestPosition={assetRequestPosition}
            assetChoiceProps={assetChoiceProps}
            
            inlineAssetComponents={inlineAssetComponents}
            blockAssetComponents={blockAssetComponents}
            AssetChoiceComponent={ExampleBlockAssetChoice}
            
            allowNotesInsertion={true}
          />
        </div>
      </div>
    );
  }
}