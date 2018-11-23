import React, { Component } from 'react'

import './App.css'

import Editor from './Editor'
import FileExplorer from './FileExplorer'

class App extends Component {
  render() {
    return (
      <div className="App">
        <FileExplorer />
        <Editor />
      </div>
    )
  }
}

export default App
