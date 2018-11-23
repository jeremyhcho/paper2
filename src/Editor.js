import React, { Component } from 'react'
import { Editor, EditorState, RichUtils, Modifier } from 'draft-js'
import { List } from "immutable"

class MainEditor extends Component {
  state = {
    editorState: EditorState.createEmpty()
  }

  onChange = (editorState) => {
    let newEditorState = editorState
    newEditorState = this.handleBackspace(editorState)
    this.setState({ editorState: newEditorState })
  }

  handleBackspace = (editorState) => {
    let contentState = editorState.getCurrentContent()
    const selectionState = editorState.getSelection()
    const blockMap = contentState.getBlockMap()
    const key = selectionState.getStartKey()
    let block = contentState.getBlockForKey(key)

    if (block.getType() === "code-block" && block.getText().length === 1) {
      block = block.merge({
        text: "",
        type: "unstyled"
      })

      contentState = contentState.merge({
        blockMap: blockMap.set(key, block)
      })

      editorState = EditorState.push(editorState, contentState, "change-block-type")
    }

    return editorState
  }

  setEditor = (editor) => {
    this.editor = editor
  }

  focusEditor = () => {
    if (this.editor) {
      this.editor.focus()
    }
  }

  shouldHandleBold(blockText) {
    const indices = []
    for (let i = 0; i < blockText.length; i++) {
      if (blockText[i] === "*") {
        indices.push(i)
      }
    }

    return (
      indices.length === 4 &&
        indices[1] - indices[0] === 1 &&
        indices[3] - indices[2] === 1 &&
        blockText.replace(" ", "").length !== 4
    )
  }

  shouldHandleItalic(blockText) {
    const indices = []
    for (let i = 0; i < blockText.length; i++) {
      if (blockText[i] === "*") {
        indices.push(i)
      }
    }

    return (
      indices.length === 2 &&
      indices[1] - indices[0] > 1 &&
      blockText.replace(" ", "").length !== 2
    )
  }

  handleDoubleSidedMd = (block, symbol, style, triggeringChar) => {
    let editorState = this.state.editorState
    let contentState = editorState.getCurrentContent()
    let selectionState = editorState.getSelection()
    const originalCharList = block.getCharacterList()
    const blockMap = contentState.getBlockMap()
    const originalText = block.getText()
    const startSymbolIndex = originalText.indexOf(symbol)
    const textToBeEdited = originalText.slice(startSymbolIndex + symbol.length, selectionState.getAnchorOffset() - symbol.length)
    const key = block.getKey()

    const strippedText =
      originalText.slice(0, startSymbolIndex) +
      textToBeEdited +
      originalText.slice(selectionState.getAnchorOffset(), originalText.length)

    // Step 1:
    // Loop through CharacterList of block, and create new CharacterList stripped of
    // markdown symbols.
    const charListConstructor = []
    for (let i = 0; i < originalCharList.size; i++) {
      if (i < startSymbolIndex) {
        // These characters appear before the opening symbol
        charListConstructor.push(originalCharList.get(i))
      } else if (i < startSymbolIndex + symbol.length) {
        // This set of characters are the opening symbols
        continue
      } else if (i < startSymbolIndex + symbol.length + textToBeEdited.length) {
        // This set of characters is the text being formatted
        charListConstructor.push(originalCharList.get(i))
      } else if (i < startSymbolIndex + (symbol.length * 2) + textToBeEdited.length) {
        // This set of characters are the closing symbols
        continue
      } else {
        // This set of characters appear after the closing symbols
        charListConstructor.push(originalCharList.get(i))
      }
    }

    const newCharList = List.of(...charListConstructor)

    // Step 2:
    // Take the new CharacterList and markdown stripped text and replace the current block.
    const newBlock = block.merge({
      characterList: newCharList,
      text: strippedText
    })

    contentState = contentState.merge({
      blockMap: blockMap.set(key, newBlock)
    })

    editorState = EditorState.push(editorState, contentState, "remove-range")

    // Step 3:
    // Insert the character that triggered this handler.
    contentState = Modifier.insertText(contentState, selectionState, triggeringChar)
    editorState = EditorState.push(editorState, contentState, "insert-characters")

    // Step 4:
    // Set selection to text between the markdown notation, and apply style.
    selectionState = selectionState.merge({
      anchorOffset: startSymbolIndex,
      focusOffset: startSymbolIndex + textToBeEdited.length
    })

    editorState = RichUtils.toggleInlineStyle(
      EditorState.forceSelection(editorState, selectionState),
      style
    )

    // Step 5:
    // Reset selection back to where the anchor was prior to transformation.
    selectionState = selectionState.merge({
      anchorOffset: startSymbolIndex + textToBeEdited.length + 1,
      focusOffset: startSymbolIndex + textToBeEdited.length + 1
    })

    return EditorState.forceSelection(editorState, selectionState)
  }

  shouldHandleHeader(block, triggeringChar) {
    if (triggeringChar === "#") {
      return [null, false]
    }

    const text = block.getText()

    let count = 0
    if (text.indexOf("#") === 0) {
      for (const char of text) {
        if (char === "#") {
          count += 1
        }
      }

      let symbol = ""
      for (let i = 0; i < count; i++) {
        symbol += "#"
      }

      return [symbol, true]
    }

    return [null, false]
  }

  handleHeader = (editorState, block, symbol, char) => {
    let contentState = editorState.getCurrentContent()
    const blockMap = contentState.getBlockMap()
    const key = block.getKey()

    let blockType
    switch (symbol) {
      case "#":
        blockType = "header-one"
        break
      case "##":
        blockType = "header-two"
        break
      case "###":
        blockType = "header-three"
        break
      default:
        console.error("Error parsing header type")
    }

    const newBlock = block.merge({
      type: blockType,
      text: ""
    })

    contentState = contentState.merge({
      blockMap: blockMap.set(key, newBlock)
    })

    return EditorState.push(editorState, contentState)
  }

  shouldHandleInlineCodeBlock = (editorState) => {
    const contentState = editorState.getCurrentContent()
    const selectionState = editorState.getSelection()
    const key = selectionState.getStartKey()
    const block = contentState.getBlockForKey(key)
    const blockText = block.getText()

    const indices = []
    for (let i = 0; i < blockText.length; i++) {
      if (blockText[i] === "`") {
        indices.push(i)
      }
    }

    return (
      indices.length === 2 &&
      indices[1] - indices[0] > 1 &&
      blockText.replace(" ", "").length !== 2
    )
  }

  handleInlineCodeBlock = (editorState) => {
    let contentState = editorState.getCurrentContent()
    const selectionState = editorState.getSelection()
    const key = selectionState.getStartKey()
    const block = contentState.getBlockForKey(key)
    const blockMap = contentState.getBlockMap()
    const text = block.getText()

    const newBlock = block.merge({
      type: "code-block",
      text: text.slice(1, text.length - 1)
    })

    contentState = contentState.merge({
      blockMap: blockMap.set(key, newBlock)
    })

    return EditorState.push(editorState, contentState, "change-block-type")
  }

  handleBeforeInput = (char) => {
    const editorState = this.state.editorState
    const selectionState = editorState.getSelection()
    const key = selectionState.getStartKey()
    const block = editorState.getCurrentContent().getBlockForKey(key)

    switch (char) {
      case " ":
        const [headerSymbol, shouldHandleHeader] = this.shouldHandleHeader(block, char)
        if (shouldHandleHeader) {
          this.onChange(this.handleHeader(editorState, block, headerSymbol))
          return "handled"
        }

      default:
        if (this.shouldHandleBold(block.getText())) {
          this.onChange(this.handleDoubleSidedMd({
            block: block,
            symbol: "**",
            style: "BOLD",
            char: char
          }))
          return "handled"
        }

        if (this.shouldHandleItalic(block.getText())) {
          this.onChange(this.handleDoubleSidedMd({
            block: block,
            symbol: "*",
            style: "ITALIC",
            char: char
          }))
          return "handled"
        }

        if (this.shouldHandleInlineCodeBlock(editorState)) {
          this.onChange(this.handleInlineCodeBlock(editorState))
          return "handled"
        }

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
          handleBeforeInput={this.handleBeforeInput}
        />
      </div>
    )
  }
}

export default MainEditor