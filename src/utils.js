import {
  EditorState,
  Modifier,
  AtomicBlockUtils,
  SelectionState
} from 'draft-js';

import {
  NOTE_POINTER
} from './constants';

export function insertContextualizationInEditor(
    editorState, 
    insertionType, 
    contextualization, 
    selection
  ) {
  let newContentState = editorState.getCurrentContent().createEntity(
      insertionType,
      'IMMUTABLE',
    {
      insertionType,
      contextualization
    }
    );
  const newEntityKey = newContentState.getLastCreatedEntityKey();
  const currentContent = editorState.getCurrentContent();
  const activeSelection = editorState.getSelection();
  const thatSelection = activeSelection.merge({
    anchorOffset: selection.getStartOffset(),
    focusOffset: selection.getEndOffset(),
    focusKey: selection.getFocusKey(),
    anchorKey: selection.getAnchorKey(),
  });
  let updatedEditor = EditorState.acceptSelection(
    EditorState.createWithContent(newContentState), 
    thatSelection
  );
  if (insertionType === 'blockContextualization') {
    updatedEditor = AtomicBlockUtils.insertAtomicBlock(
        updatedEditor,
        newEntityKey,
        ' '
      );
  } else {
    const anchorKey = thatSelection.getAnchorKey();
    const currentContentBlock = currentContent.getBlockForKey(anchorKey);
    const start = thatSelection.getStartOffset();
    const end = thatSelection.getEndOffset();
    let selectedText = currentContentBlock.getText().slice(start, end);
    if (selectedText.length > 0) {
      newContentState = Modifier.applyEntity(
          currentContent,
          thatSelection,
          newEntityKey
        );
    } else {
      selectedText = ' ';

      newContentState = Modifier.replaceText(
          currentContent,
          thatSelection,
          selectedText,
          null,
          // inlineStyle?: DraftInlineStyle,
          newEntityKey
        );
    }
    const endSelection = thatSelection.merge({
      anchorOffset: thatSelection.getEndOffset() + selectedText.length,
      focusOffset: thatSelection.getEndOffset() + selectedText.length,
    });
    newContentState = Modifier.replaceText(
        newContentState,
        endSelection,
        '  ',
        null,
        null
      );
    updatedEditor = EditorState.push(editorState, newContentState, 'apply-entity');
  }
  return updatedEditor;
}

export function insertNoteInEditor(
    editorState, 
    noteId, 
    selection
  ) {
  let newContentState = editorState.getCurrentContent().createEntity(
      NOTE_POINTER,
      'IMMUTABLE',
      {
        noteId
      }
    );
  const newEntityKey = newContentState.getLastCreatedEntityKey();
  const currentContent = editorState.getCurrentContent();
  const activeSelection = editorState.getSelection();
  // // retaining only the end of selection
  const thatSelection = activeSelection.merge({
    anchorOffset: activeSelection.getEndOffset(),
    focusOffset: activeSelection.getEndOffset(),
    focusKey: activeSelection.getAnchorKey(),
    anchorKey: activeSelection.getAnchorKey(),
  });
  let updatedEditor = EditorState.acceptSelection(
    EditorState.createWithContent(newContentState), 
    thatSelection
  );
  const anchorKey = thatSelection.getAnchorKey();
  const currentContentBlock = currentContent.getBlockForKey(anchorKey);
  const start = thatSelection.getStartOffset();
  const end = thatSelection.getEndOffset();
  let selectedText = ' ';

  newContentState = Modifier.replaceText(
      currentContent,
      thatSelection,
      selectedText,
      null,
      // inlineStyle?: DraftInlineStyle,
      newEntityKey
    );
  const endSelection = thatSelection.merge({
    anchorOffset: thatSelection.getEndOffset() + selectedText.length,
    focusOffset: thatSelection.getEndOffset() + selectedText.length,
  });
  newContentState = Modifier.replaceText(
      newContentState,
      endSelection,
      '  ',
      null,
      null
    );
  newContentState = Modifier.applyEntity(newContentState, endSelection, newEntityKey);

  updatedEditor = EditorState.push(editorState, newContentState, 'apply-entity');
  // console.log('created entity', newEntityKey, NOTE_POINTER);
  return updatedEditor;
}

export function getContextualizationsToDeleteFromEditor(
  editorState, 
  acceptedEntitiesTypes = [], 
  contextualizations = {}
) {
  const contentState = editorState.getCurrentContent();
  const blockMap = contentState.getBlockMap().toJS();
  const activeEntitiesIds = Object.keys(blockMap).reduce((finalList, blockMapId) => 
    finalList.concat(
      blockMap[blockMapId]
        .characterList
        .filter(chara => chara.entity !== null)
        .map(chara => chara.entity)
    )
  , [])
  .map(entityKey => contentState.getEntity(entityKey))
  .filter(entity => acceptedEntitiesTypes.indexOf(entity.getType()) > -1)
  .map(entity => entity.getData().contextualization.id);
  return Object.keys(contextualizations)
    .filter(key => activeEntitiesIds.indexOf(key) === -1);
}

export function deleteContextualizationFromEditor(
  editorState, 
  acceptedEntitiesTypes = [], 
  id, 
  callback
) {
  const contentState = editorState.getCurrentContent();
  const blockMap = contentState.getBlockMap().toJS();
  const entities = Object.keys(blockMap)
  // iterate through blocks
  .map(blockMapId => blockMap[blockMapId]
      .characterList
      // find characters attached to an entity
      .filter(chara => chara.entity !== null)
      // keep entities only
      .map(chara => chara.entity)
      // add info about entity and its location
      .map(entityKey => ({
        entityKey, 
        entity: contentState.getEntity(entityKey),
        blockMapId
      }))
      // find relevant entity (corresponding to the contextualization to delete)
      .find((entity) => {
        const data = entity.entity.getData();
        return data.contextualization && data.contextualization.id === id;
      })).filter(data => data !== undefined);
  if (entities.length) {
    const entityInfos = entities[0];
    return contentState.getBlockForKey(entityInfos.blockMapId).findEntityRanges(
      characterMetadata => characterMetadata.entity === entityInfos.entityKey,
      (start, end) => {
        const selectionToDelete = SelectionState.createEmpty(entityInfos.blockMapId).merge({
          anchorOffset: start,
          focusOffset: end
        });
        const newContentState = Modifier.removeRange(
          contentState,
          selectionToDelete,
        );
        const newEditor = EditorState.push(editorState, newContentState, 'replace-text');
        return callback(newEditor);
      });

  }
  return callback(editorState);
}

export function deleteNoteFromEditor(
  editorState, 
  id, 
  callback
) {
  const contentState = editorState.getCurrentContent();
  const blockMap = contentState.getBlockMap().toJS();
  const entities = Object.keys(blockMap)
  // iterate through blocks
  .map(blockMapId => blockMap[blockMapId]
      .characterList
      // find characters attached to an entity
      .filter(chara => chara.entity !== null)
      // keep entities only
      .map(chara => chara.entity)
      // add info about entity and its location
      .map(entityKey => ({
        entityKey, 
        entity: contentState.getEntity(entityKey),
        blockMapId
      }))
      // find relevant entity (corresponding to the contextualization to delete)
      .find((entity) => {
        const data = entity.entity.getData();
        return data.noteId === id;
      })).filter(data => data !== undefined);
  if (entities.length) {
    const entityInfos = entities[0];
    return contentState.getBlockForKey(entityInfos.blockMapId).findEntityRanges(
      characterMetadata => characterMetadata.entity === entityInfos.entityKey,
      (start, end) => {
        const selectionToDelete = SelectionState.createEmpty(entityInfos.blockMapId).merge({
          anchorOffset: start,
          focusOffset: end
        });
        const newContentState = Modifier.removeRange(
          contentState,
          selectionToDelete,
        );
        const newEditor = EditorState.push(editorState, newContentState, 'replace-text');
        return callback(newEditor);
      });

  }
  return callback(editorState);
}

export const updateNotesFromEditor = (editorState, inputNotes) => {
  const notes = {...inputNotes};
  const contentState = editorState.getCurrentContent();
  const blockMap = contentState.getBlockMap().toJS();
  // list active entities
  const noteEntities = Object.keys(blockMap).reduce((entities, blockMapId) => {
    const newEnt = blockMap[blockMapId]
        .characterList
        // find characters attached to an entity
        .filter(chara => chara.entity !== null)
        // keep entities only
        .map(chara => chara.entity)
        // add info about entity and its location
        .map(entityKey => ({
          entityKey, 
          entity: contentState.getEntity(entityKey),
          blockMapId
        }))
        // find relevant entity (corresponding to the contextualization to delete)
        .filter((thatEntity) => {
          return thatEntity.entity.getType() === NOTE_POINTER;
        });
    return entities.concat(newEnt);
  }, []);
  //attribute orders to notes
  let order = 0;
  noteEntities.forEach(entity => {
    const noteId = entity.entity.getData().noteId;
    order ++;
    if (notes[noteId]) {
      notes[noteId].order = order;
    } else {
      console.log('could note attribute order to note', noteId, ' in ', notes);
    }
  });
  // filter unused notes
  return Object.keys(notes)
  .filter(noteId => {
    const note = notes[noteId];
    let entityIndex;
    const entity = noteEntities.find((noteEntity, index) => noteEntity.entity.getData().noteId === noteId);
    return entity !== undefined;
  })
  .reduce((finalNotes, noteId) => {
    const note = notes[noteId];
    return {
      ...finalNotes,
      [noteId]: note
    }
  }, {});
}

const getContextualizationEntity = (editorState, id) => {
  const contentState = editorState.getCurrentContent();
  const blockMap = contentState.getBlockMap().toJS();
  const entity = Object.keys(blockMap)
  // iterate through blocks
  .find(blockMapId => blockMap[blockMapId]
      .characterList
      // find characters attached to an entity
      .filter(chara => chara.entity !== null)
      // keep entities only
      .map(chara => chara.entity)
      // add info about entity and its location
      .map(entityKey => ({
        entityKey, 
        entity: contentState.getEntity(entityKey),
        blockMapId
      }))
      // find relevant entity (corresponding to the contextualization to delete)
      .find((thatEntity) => {
        const data = thatEntity.entity.getData();
        return data.contextualization && data.contextualization.id === id;
      }));
  return entity;
};

export function getUnusedContextualizations(editorState, contextualizations) {
  return Object
  .keys(contextualizations)
  .filter(id => getContextualizationEntity(editorState, id) === undefined);
}
