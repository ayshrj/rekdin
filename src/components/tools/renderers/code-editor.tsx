"use client"

import React from "react"

import { SimpleCodeEditor } from "./simple-code-editor"

interface CodeEditorProps {
  code: string
  language: string
  fileName?: string
  showLineNumbers?: boolean
  maxHeight?: string
  className?: string
  readOnly?: boolean
  fontSize?: number
}

export function CodeEditor(props: CodeEditorProps) {
  return <SimpleCodeEditor {...props} showHeader />
}
