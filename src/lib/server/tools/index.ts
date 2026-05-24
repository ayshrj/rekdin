export * from "./agent/agent-tools"
export * from "./api/api-contract-tools"
export * from "./artifacts/artifact-extended-tools"
export * from "./artifacts/artifact-tools"
export * from "./browser/browser-core"
export * from "./browser/browser-tools"
export * from "./browser/browser-visual-tools"
export * from "./code/architecture-tools"
export * from "./code/code-analysis-tools"
export * from "./code/code-execution-tools"
export * from "./code/code-intelligence-tools"
export * from "./code/code-map-tools"
export * from "./code/refactor-tools"
export * from "./data/data-tools"
export * from "./database/database-tools"
export * from "./dev/dev-extended-tools"
export * from "./dev/dev-server-tools"
export * from "./dev/package-tools"
export * from "./docs/docs-tools"
export * from "./documents/data-query-tools"
export * from "./documents/document-tools"
export * from "./git/git-tools"
export * from "./github/github-tools"
export * from "./images/image-tools"
export * from "./llm/llm-tools"
export * from "./next/next-tools"
export * from "./pdf/latex-tools"
export * from "./pdf/pdf-tools"
export * from "./performance/performance-tools"
export * from "./security/security-tools"
export * from "./sessions/session-tools"
export * from "./sessions/settings-tools"
export * from "./sessions/trace-tools"
export * from "./shared/command"
export * from "./shared/csv"
export * from "./shared/formatting"
export * from "./shared/json"
export * from "./shared/loaders"
export * from "./shared/patching"
export * from "./testing/testing-tools"
export * from "./ui/ui-audit-tools"
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
export * from "./workflows/workflow-tools"
export * from "./workspace/workspace-fs"
export * from "./workspace/workspace-scans"
export * from "./workspace/workspace-tools"

import {
  agentDiffReviewTool,
  agentPlanCheckTool,
  agentPlanCreateTool,
  agentRegressionRiskTool,
  agentSelfCheckTool,
  agentWorklogTool,
} from "./agent/agent-tools"
import {
  apiContractDiffTool,
  apiContractMapTool,
  apiErrorTaxonomyTool,
  apiPayloadInferTool,
  apiRouteMapTool,
  curlFromApiCallTool,
  postmanCollectionGenerateTool,
} from "./api/api-contract-tools"
import {
  artifactBundleTool,
  artifactConvertTool,
  artifactPreviewTool,
} from "./artifacts/artifact-extended-tools"
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
  cssComputedStyleExtractTool,
  domLayoutBoxMapTool,
  pageVisualAuditTool,
  responsiveScreenshotMatrixTool,
  screenshotCompareTool,
} from "./browser/browser-visual-tools"
import {
  architectureSummaryTool,
  circularDependencyCheckTool,
  complexityHotspotsTool,
  couplingReportTool,
  featureMapTool,
  ownershipMapTool,
} from "./code/architecture-tools"
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
  componentMapTool,
  eventHandlerTraceTool,
  hookMapTool,
  propDrillingTraceTool,
  stateFlowTraceTool,
  typeDependencyTraceTool,
} from "./code/code-intelligence-tools"
import {
  codeMapTool,
  configInventoryTool,
  envInventoryTool,
  lockfileSummaryTool,
  routeMapTool,
  testMapTool,
} from "./code/code-map-tools"
import {
  barrelExportSyncTool,
  deadImportsFixTool,
  extractComponentTool,
  extractFunctionTool,
  importRewriteTool,
  moduleBoundaryCheckTool,
  moveSymbolToFileTool,
  safeRenameSymbolTool,
} from "./code/refactor-tools"
import {
  csvProfileTool,
  jsonProfileTool,
  logErrorClusterTool,
  logParseTool,
} from "./data/data-tools"
import {
  drizzleSchemaInspectTool,
  erdGenerateTool,
  migrationDiffSummaryTool,
  prismaSchemaInspectTool,
  sqlSchemaMapTool,
} from "./database/database-tools"
import {
  envExampleGenerateTool,
  onboardingSummaryTool,
  setupHealthCheckTool,
  todoToIssuesTool,
} from "./dev/dev-extended-tools"
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
  agentsMdSyncTool,
  changelogGenerateTool,
  docsIndexTool,
  docsMissingReportTool,
  readmeGenerateOrUpdateTool,
  releaseNotesGenerateTool,
} from "./docs/docs-tools"
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
  branchCleanupCandidatesTool,
  githubActionLogsAnalyzeTool,
  githubIssueTriageTool,
  githubPrSummaryTool,
  prDescriptionGenerateTool,
} from "./github/github-tools"
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
import {
  evalCaseGenerateTool,
  examplesValidateAgainstSchemaTool,
  jsonOutputRepairTool,
  llmResponseAuditTool,
  promptLintTool,
  schemaFromExamplesTool,
} from "./llm/llm-tools"
import {
  nextApiRuntimeAuditTool,
  nextImageAuditTool,
  nextMetadataAuditTool,
  nextRouteSegmentMapTool,
  serverClientBoundaryMapTool,
} from "./next/next-tools"
import { createGenerateLatexPdfTool } from "./pdf/latex-tools"
import { createMarkdownToPdfTool } from "./pdf/pdf-tools"
import { pdfExtractTextTool } from "./pdf/pdf-tools"
import {
  assetSizeAuditTool,
  bundleAnalyzeSummaryTool,
  clientBoundaryAuditTool,
  largeDependencyReportTool,
  renderRiskAuditTool,
} from "./performance/performance-tools"
import {
  authFlowAuditTool,
  clientSecretLeakCheckTool,
  dangerousCommandDetectTool,
  dependencyConfusionCheckTool,
  envUsageAuditTool,
  permissionBoundaryAuditTool,
} from "./security/security-tools"
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
import {
  generateUnitTestDraftTool,
  mockWorkspaceCreateTool,
  snapshotDiffExplainTool,
  testFailureExplainTool,
  testGapAnalysisTool,
  toolContractTestGenerateTool,
} from "./testing/testing-tools"
import {
  accessibilityAuditStaticTool,
  componentDesignAuditTool,
  iconUsageMapTool,
  responsiveBreakpointAuditTool,
  shadcnUsageAuditTool,
  storybookStoryGenerateTool,
  tailwindClassAuditTool,
} from "./ui/ui-audit-tools"
import { uiControlTool } from "./ui/ui-control-tool"
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
  workflowCompareTool,
  workflowInventoryTool,
  workflowRunDryTool,
  workflowValidateTool,
} from "./workflows/workflow-tools"
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

    // Agent meta-tools
    agentPlanCreateTool,
    agentPlanCheckTool,
    agentWorklogTool,
    agentSelfCheckTool,
    agentDiffReviewTool,
    agentRegressionRiskTool,

    // API contract tools
    apiContractMapTool,
    apiContractDiffTool,
    apiRouteMapTool,
    apiPayloadInferTool,
    postmanCollectionGenerateTool,
    curlFromApiCallTool,
    apiErrorTaxonomyTool,

    // Architecture tools
    architectureSummaryTool,
    featureMapTool,
    ownershipMapTool,
    complexityHotspotsTool,
    couplingReportTool,
    circularDependencyCheckTool,

    // Browser visual tools
    screenshotCompareTool,
    pageVisualAuditTool,
    responsiveScreenshotMatrixTool,
    domLayoutBoxMapTool,
    cssComputedStyleExtractTool,

    // Code intelligence tools
    componentMapTool,
    hookMapTool,
    stateFlowTraceTool,
    typeDependencyTraceTool,
    propDrillingTraceTool,
    eventHandlerTraceTool,

    // Database tools
    prismaSchemaInspectTool,
    drizzleSchemaInspectTool,
    sqlSchemaMapTool,
    migrationDiffSummaryTool,
    erdGenerateTool,

    // Docs tools
    docsIndexTool,
    docsMissingReportTool,
    readmeGenerateOrUpdateTool,
    agentsMdSyncTool,
    changelogGenerateTool,
    releaseNotesGenerateTool,

    // GitHub tools
    githubPrSummaryTool,
    githubIssueTriageTool,
    githubActionLogsAnalyzeTool,
    prDescriptionGenerateTool,
    branchCleanupCandidatesTool,

    // LLM tools
    promptLintTool,
    jsonOutputRepairTool,
    schemaFromExamplesTool,
    examplesValidateAgainstSchemaTool,
    evalCaseGenerateTool,
    llmResponseAuditTool,

    // Workflow tools
    workflowInventoryTool,
    workflowValidateTool,
    workflowRunDryTool,
    workflowCompareTool,

    // Performance tools
    bundleAnalyzeSummaryTool,
    largeDependencyReportTool,
    clientBoundaryAuditTool,
    renderRiskAuditTool,
    assetSizeAuditTool,

    // Next.js tools
    nextRouteSegmentMapTool,
    serverClientBoundaryMapTool,
    nextMetadataAuditTool,
    nextImageAuditTool,
    nextApiRuntimeAuditTool,

    // Refactor tools
    safeRenameSymbolTool,
    moveSymbolToFileTool,
    extractFunctionTool,
    extractComponentTool,
    barrelExportSyncTool,
    importRewriteTool,
    deadImportsFixTool,
    moduleBoundaryCheckTool,

    // Security tools
    authFlowAuditTool,
    permissionBoundaryAuditTool,
    dangerousCommandDetectTool,
    dependencyConfusionCheckTool,
    envUsageAuditTool,
    clientSecretLeakCheckTool,

    // Testing tools
    testGapAnalysisTool,
    generateUnitTestDraftTool,
    testFailureExplainTool,
    snapshotDiffExplainTool,
    toolContractTestGenerateTool,
    mockWorkspaceCreateTool,

    // UI control + audit tools
    uiControlTool,
    tailwindClassAuditTool,
    componentDesignAuditTool,
    responsiveBreakpointAuditTool,
    accessibilityAuditStaticTool,
    storybookStoryGenerateTool,
    shadcnUsageAuditTool,
    iconUsageMapTool,

    // Data tools
    logParseTool,
    logErrorClusterTool,
    csvProfileTool,
    jsonProfileTool,

    // Artifact extended tools
    artifactPreviewTool,
    artifactConvertTool,
    artifactBundleTool,

    // Dev extended tools
    todoToIssuesTool,
    envExampleGenerateTool,
    setupHealthCheckTool,
    onboardingSummaryTool,

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
