export * from "./artifacts/artifact-tools"
export * from "./browser/browser-core"
export * from "./browser/browser-tools"
export * from "./code/code-analysis-tools"
export * from "./code/code-execution-tools"
export * from "./code/code-map-tools"
export * from "./dev/dev-server-tools"
export * from "./dev/package-tools"
export * from "./documents/data-query-tools"
export * from "./documents/document-tools"
export * from "./git/git-tools"
export * from "./images/image-tools"
export * from "./pdf/latex-tools"
export * from "./pdf/pdf-tools"
export * from "./sessions/session-tools"
export * from "./sessions/settings-tools"
export * from "./sessions/trace-tools"
export * from "./shared/command"
export * from "./shared/csv"
export * from "./shared/formatting"
export * from "./shared/json"
export * from "./shared/loaders"
export * from "./shared/patching"
export * from "./utilities/archive-tools"
export * from "./utilities/crypto-tools"
export * from "./utilities/encoding-tools"
export * from "./utilities/misc-tools"
export * from "./utilities/patching-tools"
export * from "./utilities/text-tools"
export * from "./utilities/validation-tools"
export * from "./web/metadata-tools"
export * from "./web/network-tools"
export * from "./web/web-tools"
export * from "./workspace/workspace-fs"
export * from "./workspace/workspace-scans"
export * from "./workspace/workspace-tools"

import { artifactDeleteTool, artifactListTool, artifactReadTool } from "./artifacts/artifact-tools"
import {
  browserAccessibilitySnapshotTool,
  browserActionTool,
  browserClickTool,
  browserConsoleLogsTool,
  browserControlTool,
  browserDoubleClickTool,
  browserDownloadsTool,
  browserDragAndDropTool,
  browserDragTool,
  browserEvaluateTool,
  browserExtractTool,
  browserFormFillBatchTool,
  browserFormFillTool,
  browserFormSchemaTool,
  browserFullPageScreenshotTool,
  browserGetClickableElementsTool,
  browserGetLinksTool,
  browserGetMarkdownTool,
  browserGetTextTool,
  browserHotkeyTool,
  browserHoverTool,
  browserKeyPressTool,
  browserNavigateTool,
  browserNetworkLogTool,
  browserPrintPdfTool,
  browserRightClickTool,
  browserScreenshotTool,
  browserScrollTool,
  browserSelectorScreenshotTool,
  browserSetViewportTool,
  browserStorageSnapshotTool,
  browserTableExtractTool,
  browserTypeTool,
  browserVisionControlTool,
  browserWaitForTool,
  browserWaitTool,
} from "./browser/browser-tools"
import {
  deadCodeCandidatesTool,
  dependencyGraphTool,
  duplicateCodeCandidatesTool,
  fileOutlineTool,
  symbolReferencesTool,
  symbolSearchTool,
} from "./code/code-analysis-tools"
import {
  nodeCodeActTool,
  nodeExecuteTool,
  pythonCodeActTool,
  pythonExecuteTool,
  shellCodeActTool,
  shellExecuteTool,
} from "./code/code-execution-tools"
import {
  codeMapTool,
  configInventoryTool,
  envInventoryTool,
  lockfileSummaryTool,
  routeMapTool,
  testMapTool,
} from "./code/code-map-tools"
import {
  clipboardReadTool,
  clipboardWriteTool,
  desktopNotifyTool,
  devServerStartTool,
  devServerStatusTool,
  devServerStopTool,
  httpHealthCheckTool,
  portProbeTool,
  processListTool,
  systemInfoTool,
} from "./dev/dev-server-tools"
import {
  buildProjectTool,
  formatCheckTool,
  lintProjectTool,
  npmScriptsTool,
  runNpmScriptTool,
  testProjectTool,
  typecheckProjectTool,
} from "./dev/package-tools"
import {
  csvPreviewTool,
  csvQueryTool,
  jsonQueryTool,
  sqliteQueryTool,
  yamlQueryTool,
} from "./documents/data-query-tools"
import { docxExtractTextTool } from "./documents/document-tools"
import {
  htmlTableExtractTool,
  markdownFrontmatterTool,
  textKeywordsTool,
  tokenCountTool,
} from "./documents/document-tools"
import {
  gitApplyPatchTool,
  gitBlameTool,
  gitBranchesTool,
  gitChangedFilesTool,
  gitCheckoutTool,
  gitCommitSearchTool,
  gitCommitTool,
  gitCompareRefsTool,
  gitConflictsTool,
  gitDiffSummaryTool,
  gitFileHistoryTool,
  gitLogSummaryTool,
  gitPatchPreviewTool,
  gitPushTool,
  gitRemoteInfoTool,
  gitShowTool,
  gitStagedDiffTool,
  gitStashTool,
  gitStatusTool,
  gitTagsTool,
} from "./git/git-tools"
import {
  assetManifestTool,
  imageConvertTool,
  imageCropTool,
  imageDiffTool,
  imageExifTool,
  imageInfoTool,
  imageOcrTool,
  imageResizeTool,
  svgOptimizeTool,
} from "./images/image-tools"
import { createGenerateLatexPdfTool } from "./pdf/latex-tools"
import { createMarkdownToPdfTool } from "./pdf/pdf-tools"
import { pdfExtractTextTool } from "./pdf/pdf-tools"
import {
  replaySearchTool,
  replaySummaryTool,
  sessionInspectTool,
  sessionListTool,
} from "./sessions/session-tools"
import { settingsSummaryTool } from "./sessions/settings-tools"
import {
  backgroundJobsSummaryTool,
  tokenUsageReportTool,
  traceSummaryTool,
} from "./sessions/trace-tools"
import { archiveCreateTool, archiveExtractTool } from "./utilities/archive-tools"
import { hashTool } from "./utilities/crypto-tools"
import { jwtDecodeTool, uuidGenerateTool } from "./utilities/crypto-tools"
import { base64DecodeTool, base64EncodeTool } from "./utilities/encoding-tools"
import {
  colorConvertTool,
  cronExplainTool,
  jsonDiffTool,
  regexMatchTool,
  textDiffTool,
  urlParseTool,
} from "./utilities/misc-tools"
import { fileReplaceTool, jsonPatchTool, yamlPatchTool } from "./utilities/patching-tools"
import {
  extractTodosTool,
  textEntitiesTool,
  textRewriteTool,
  textSummarizeTool,
} from "./utilities/text-tools"
import {
  csvToJsonTool,
  jsonSchemaValidateTool,
  jsonToCsvTool,
  urlSafetyCheckTool,
  xmlToJsonTool,
  xpathQueryTool,
} from "./utilities/validation-tools"
import {
  citationMetadataTool,
  githubRepoInfoTool,
  graphqlIntrospectTool,
  linkPreviewTool,
  npmPackageInfoTool,
  openapiInspectTool,
  packageCompareTool,
  pageMetadataBatchTool,
  robotsTxtTool,
  rssFetchTool,
  sitemapFetchTool,
} from "./web/metadata-tools"
import {
  dnsLookupTool,
  domainInfoTool,
  downloadFetchTool,
  fetchManyTool,
  httpRequestTool,
  pingTool,
  sslCheckTool,
  whoisLookupTool,
} from "./web/network-tools"
import { pageDiffSnapshotTool, searchBatchTool, visitUrlTool, webSearchTool } from "./web/web-tools"
import {
  dependencyAuditTool,
  dockerfileScanTool,
  licenseSummaryTool,
  lockfileRiskSummaryTool,
  sbomGenerateTool,
  secretScanTool,
  semgrepScanTool,
  workspacePermissionsScanTool,
} from "./workspace/workspace-scans"
import {
  executeCommandTool,
  fileHeadTailTool,
  fileSearchTool,
  fileStatTool,
  listFilesTool,
  readFileTool,
  workspaceStatsTool,
  writeFileTool,
} from "./workspace/workspace-tools"

/**
 * Builds the full LangChain tool list and filters it through an optional allowlist.
 */
export function createToolset(context?: { headers?: HeadersInit; allowedToolNames?: string[] }) {
  const generateLatexPdfTool = createGenerateLatexPdfTool(context)
  const markdownToPdfTool = createMarkdownToPdfTool(context)
  const tools = [
    // Content/API tools
    webSearchTool,
    searchBatchTool,
    visitUrlTool,
    fetchManyTool,
    httpRequestTool,
    downloadFetchTool,
    robotsTxtTool,
    sitemapFetchTool,
    rssFetchTool,
    pageMetadataBatchTool,
    pageDiffSnapshotTool,
    citationMetadataTool,
    domainInfoTool,
    githubRepoInfoTool,
    packageCompareTool,
    linkPreviewTool,
    npmPackageInfoTool,

    // Rekdin inspectability
    sessionListTool,
    sessionInspectTool,
    replaySummaryTool,
    replaySearchTool,
    traceSummaryTool,
    tokenUsageReportTool,
    backgroundJobsSummaryTool,
    settingsSummaryTool,

    // File system + search
    codeMapTool,
    fileStatTool,
    workspaceStatsTool,
    fileHeadTailTool,
    fileOutlineTool,
    symbolSearchTool,
    symbolReferencesTool,
    dependencyGraphTool,
    routeMapTool,
    testMapTool,
    configInventoryTool,
    envInventoryTool,
    lockfileSummaryTool,
    duplicateCodeCandidatesTool,
    deadCodeCandidatesTool,
    fileSearchTool,
    fileReplaceTool,
    jsonPatchTool,
    yamlPatchTool,
    archiveCreateTool,
    archiveExtractTool,
    readFileTool,
    listFilesTool,
    writeFileTool,

    // Browser
    browserNavigateTool,
    browserGetMarkdownTool,
    browserScreenshotTool,
    browserControlTool,
    browserVisionControlTool,
    browserActionTool,
    browserClickTool,
    browserDoubleClickTool,
    browserRightClickTool,
    browserHoverTool,
    browserScrollTool,
    browserTypeTool,
    browserFormFillTool,
    browserFormFillBatchTool,
    browserWaitTool,
    browserWaitForTool,
    browserExtractTool,
    browserGetTextTool,
    browserGetLinksTool,
    browserGetClickableElementsTool,
    browserAccessibilitySnapshotTool,
    browserConsoleLogsTool,
    browserNetworkLogTool,
    browserStorageSnapshotTool,
    browserSetViewportTool,
    browserSelectorScreenshotTool,
    browserFullPageScreenshotTool,
    browserPrintPdfTool,
    browserDownloadsTool,
    browserFormSchemaTool,
    browserTableExtractTool,
    browserDragAndDropTool,
    browserDragTool,
    browserKeyPressTool,
    browserHotkeyTool,
    browserEvaluateTool,

    // Execution
    nodeExecuteTool,
    pythonExecuteTool,
    nodeCodeActTool,
    pythonCodeActTool,
    shellCodeActTool,
    shellExecuteTool,
    executeCommandTool,
    npmScriptsTool,
    runNpmScriptTool,
    typecheckProjectTool,
    lintProjectTool,
    testProjectTool,
    formatCheckTool,
    buildProjectTool,
    devServerStartTool,
    devServerStopTool,
    devServerStatusTool,
    portProbeTool,
    httpHealthCheckTool,

    // Document & conversions
    generateLatexPdfTool,
    markdownToPdfTool,
    pdfExtractTextTool,
    docxExtractTextTool,

    // Data transforms
    base64EncodeTool,
    base64DecodeTool,
    hashTool,
    textSummarizeTool,
    textRewriteTool,
    extractTodosTool,
    csvPreviewTool,
    csvQueryTool,
    jsonQueryTool,
    yamlQueryTool,
    sqliteQueryTool,
    htmlTableExtractTool,
    markdownFrontmatterTool,
    tokenCountTool,
    textKeywordsTool,
    textEntitiesTool,
    imageInfoTool,
    imageConvertTool,
    imageExifTool,
    imageOcrTool,
    imageDiffTool,
    svgOptimizeTool,
    assetManifestTool,
    artifactListTool,
    artifactReadTool,
    artifactDeleteTool,
    secretScanTool,
    dependencyAuditTool,
    licenseSummaryTool,
    sbomGenerateTool,
    lockfileRiskSummaryTool,
    semgrepScanTool,
    dockerfileScanTool,
    urlSafetyCheckTool,
    workspacePermissionsScanTool,

    // Repo info
    gitLogSummaryTool,
    gitBranchesTool,
    gitDiffSummaryTool,
    gitBlameTool,
    gitFileHistoryTool,
    gitStatusTool,
    gitChangedFilesTool,
    gitStagedDiffTool,
    gitShowTool,
    gitCompareRefsTool,
    gitConflictsTool,
    gitTagsTool,
    gitRemoteInfoTool,
    gitCommitSearchTool,
    gitPatchPreviewTool,
    gitApplyPatchTool,

    // Developer utilities (Cluster A)
    jwtDecodeTool,
    regexMatchTool,
    uuidGenerateTool,
    urlParseTool,
    cronExplainTool,
    colorConvertTool,

    // Diff & comparison (Cluster B)
    textDiffTool,
    jsonDiffTool,

    // Git write (Cluster C)
    gitCommitTool,
    gitCheckoutTool,
    gitStashTool,
    gitPushTool,

    // System & process (Cluster D)
    processListTool,
    systemInfoTool,
    clipboardReadTool,
    clipboardWriteTool,
    desktopNotifyTool,

    // Network diagnostics (Cluster E)
    dnsLookupTool,
    sslCheckTool,
    pingTool,
    whoisLookupTool,

    // API development (Cluster F)
    openapiInspectTool,
    graphqlIntrospectTool,

    // Image tools (Cluster G)
    imageResizeTool,
    imageCropTool,

    // Data format (Cluster H)
    jsonSchemaValidateTool,
    csvToJsonTool,
    jsonToCsvTool,
    xmlToJsonTool,
    xpathQueryTool,
  ]
  if (!context || !context.allowedToolNames) {
    return tools
  }
  const allowed = new Set(context.allowedToolNames)
  return tools.filter((tool) => allowed.has(tool.name))
}

/**
 * Default unfiltered toolset used by callers that do not pass request-specific context.
 */
export const toolset = createToolset()
