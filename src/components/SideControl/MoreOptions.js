import React, { Component } from 'react';
import defaultButtons from './defaultButtons';
import PropTypes from 'prop-types';

const popoverSpacing = 3; // The distance above the selection that popover 
  // will display

const styles = {
  container: {
  },
  innerContainer: {
  },
  iconContainer: {
    display: 'inline-block',
    height: 24,
    width: 24,
  },
  selectedIconContainer: {

  },
};

export default class MoreOptions extends Component {

  static propTypes = {
		/**
     * Override the inline styles for the container.
     */
    style: PropTypes.object,
		
    toggleBlockType: PropTypes.func,
    selectedBlockType: PropTypes.string,

		/**
		 * The icon fill colour
		 */
    iconColor: PropTypes.string,

		/**
		 * The icon fill colour when selected
		 */
    iconSelectedColor: PropTypes.string,

		/**
		 * Override the block buttons.
		 */
    buttons: PropTypes.array,
  };

  static defaultProps = {
    iconColor: '#000000',
    iconSelectedColor: '#2000FF',
  };

  toggleBlockType = (blockType) => {
    if (this.props.toggleBlockType) { this.props.toggleBlockType(blockType); }
  };

  render = () => {

    const { 
			iconColor, 
			iconSelectedColor, 
			style,
			buttons, 
			updateEditorState,
			editorState,
		} = this.props;

    return (<div 
      style={Object.assign({}, styles.container)}
      className="MoreOptions"
    >
      <div 
        className="inner-container"
        style={Object.assign({}, styles.innerContainer, style)}
      >
        {(buttons || defaultButtons).map((button, key) => React.cloneElement(button, {
	          // Pass down some useful props to each button
	          updateEditorState,
	          editorState,
	          iconColor,
	          iconSelectedColor,
	          key
	        })
	      )}
      </div>
    </div>);
  }
}
