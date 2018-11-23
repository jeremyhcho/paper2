import React, { Component } from 'react'
import { Editor, EditorState, RichUtils, CharacterMetadata } from 'draft-js'

class MainEditor extends Component {
  state = {
    editorState: EditorState.createEmpty()
  }

  componentDidMount() {
    this.focusEditor()
  }

  onChange = (editorState) => {
    this.setState({ editorState })
  }

  setEditor = (editor) => {
    this.editor = editor
  }

  focusEditor = () => {
    if (this.editor) {
      this.editor.focus()
    }
  }

  handleMarkdown = ({ blockType, symbol, notationType }) => {
    let editorState = this.state.editorState
    const contentState = editorState.getCurrentContent()
    const selectionState = editorState.getSelection()
    const key = selectionState.getStartKey()
    const blockMap = contentState.getBlockMap()
    const block = blockMap.get(key)
    const notationLength = symbol.length
    const text = block.getText()
    const indexOfSymbol = text.indexOf(symbol)
    const selectionText = text.slice(indexOfSymbol, selectionState.getAnchorOffset())
    let strippedSelectionText
    let newText = ''

    if (notationType === "one-sided") {
      if (text.length > notationLength) {
        newText = text.substr(notationLength)
      }
      newText = text.substr(notationLength)
    } else if (notationType === "double-sided") {
      if (selectionText.length > notationLength * 2) {
        strippedSelectionText = selectionText.slice(notationLength, selectionText.length - notationLength + 1)
        newText = text.slice(0, indexOfSymbol) + strippedSelectionText + text.slice(indexOfSymbol + strippedSelectionText.length + (notationLength * 2) - 1, text.length)
        // console.log(text.slice(0, indexOfSymbol))
        // console.log(strippedSelectionText)
        // console.log(text.slice(indexOfSymbol + strippedSelectionText.length + (notationLength * 2) - 1, text.length))
      }
    }

    let replacementBlock = block.merge({
      text: newText,
      type: blockType
    })

    // let charList = replacementBlock.getCharacterList()
    // const arrayCharList = charList.toArray()
    // for (let i = indexOfSymbol; i < arrayCharList.length; i++) {
    //   const styles = arrayCharList[i].getStyle().toArray()
    //   let newChar
    //   if (i > indexOfSymbol && i < indexOfSymbol + strippedSelectionText.length) {
    //     newChar = arrayCharList[i - notationLength]
    //     for (const style of styles) {
    //       newChar = CharacterMetadata.applyStyle(arrayCharList[i - notationLength], style)
    //     }

    //     charList = charList.set(i - notationLength, newChar)
    //     replacementBlock = replacementBlock.merge({
    //       characterList: charList
    //     })
      // } else if (i >= indexOfSymbol + strippedSelectionText.length) {
      //   newChar = arrayCharList[i - (notationLength * 2) - 1]
      //   for (const style of styles) {
      //     newChar = CharacterMetadata.applyStyle(arrayCharList[i - (notationLength * 2) - 1], style)
      //   }

      //   charList = charList.set(i - (notationLength * 2) - 1, newChar)
      //   replacementBlock = replacementBlock.merge({
      //     characterList: charList
      //   })
    //   }
    // }

    const newContentState = contentState.merge({
      blockMap: blockMap.set(key, replacementBlock)
    })


    editorState = EditorState.push(editorState, newContentState, 'change-block-type')

    const newSelectionState = selectionState.merge({
      anchorOffset: indexOfSymbol,
      focusOffset: indexOfSymbol + strippedSelectionText
    })

    editorState = EditorState.forceSelection(editorState, newSelectionState)

    return editorState
  }

  resetOffsets = (editorState) => {
    const selectionState = editorState.getSelection()
    const newSelectionState = selectionState.merge({
        anchorOffset: selectionState.getFocusOffset(),
        focusOffset: selectionState.getFocusOffset()
    })

    return EditorState.forceSelection(editorState, newSelectionState)
  }

  shouldHandleBold(blockText) {
    const indices = []
    for (let i = 0; i < blockText.length; i++) {
      if (blockText[i] === "*") {
        indices.push(i)
      }
    }

    return indices.length === 3 && indices[1] - indices[0] === 1
  }

  shouldHandleItalic(blockText, anchorOffset) {
    const indices = []
    for (let i = 0; i < blockText.length; i++) {
      if (blockText[i] === "*") {
        indices.push(i)
      }
    }

    return indices.length === 1 && blockText[anchorOffset - 1] !== "*"
  }

  handleSpecialKeys = (char) => {
    const editorState = this.state.editorState
    const selection = editorState.getSelection()
    const currentBlock = editorState.getCurrentContent().getBlockForKey(selection.getStartKey())
    const blockLength = currentBlock.getLength()
    const blockText = currentBlock.getText()

    switch (char) {
      case " ":
        if (blockLength === 1 && blockText === "#") {
          this.onChange(this.handleMarkdown("header-one", 1, "one-sided"))
          return "handled"
        }

        if (blockLength === 2 && blockText === "##") {
          this.onChange(this.handleMarkdown("header-two", 2, "one-sided"))
          return "handled"
        }

        if (blockLength === 3 && blockText === "###") {
          this.onChange(this.handleMarkdown("header-three", 3, "one-sided"))
          return "handled"
        }

        return "unhandled"
      case "*":
        if (this.shouldHandleBold(blockText)) {
          this.onChange(
            this.resetOffsets(
              RichUtils.toggleInlineStyle(
                this.handleMarkdown({
                  blockType: "unstyled",
                  notationType: "double-sided",
                  symbol: "**"
                }),
                "BOLD"
              )
            )
          )
          return "handled"
        }
        if (this.shouldHandleItalic(blockText, selection.getAnchorOffset())) {
          this.onChange(
            this.resetOffsets(
              RichUtils.toggleInlineStyle(
                this.handleMarkdown({
                  blockType: "unstyled",
                  symbol: "*",
                  notationType: "double-sided"
                }),
                "ITALIC"
              )
            )
          )
          return "handled"
        }
        return "unhandled"
      default:
        return "unhandled"
    }
  }

  render() {
    return (
      <div onClick={this.focusEditor}>
        <Editor
          ref={this.setEditor}
          editorState={this.state.editorState}
          onChange={this.onChange}
          handleBeforeInput={this.handleSpecialKeys}
        />
      </div>
    )
  }
}

export default MainEditor
