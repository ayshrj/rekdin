import * as React from "react"

const DEFAULT_SIZE = 24
const DEFAULT_STROKE_WIDTH = 1.5

type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number
}

type BaseIconProps = IconProps & {
  children?: React.ReactNode
  viewBox?: string
}

const IconBase: React.FC<BaseIconProps> = ({
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  viewBox = "0 0 24 24",
  children,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {children}
  </svg>
)

const ExclamationCircle: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
    />
  </IconBase>
)

const Check: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </IconBase>
)

const Eye: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </IconBase>
)

const EyeSlash: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
    />
  </IconBase>
)

const Cog: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 12 12m6.894 5.785-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495"
    />
  </IconBase>
)

const Cog6Tooth: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </IconBase>
)

const Cog8Tooth: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </IconBase>
)

const ArrowDownTray: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </IconBase>
)

const ArrowUpTray: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
    />
  </IconBase>
)

const Plus: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </IconBase>
)

const Minus: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
  </IconBase>
)

const Trash: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
    />
  </IconBase>
)

const Moon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
    />
  </IconBase>
)

const Sun: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
    />
  </IconBase>
)

const Globe: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
    />
  </IconBase>
)

const PaperClip: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13"
    />
  </IconBase>
)

const PaperAirplane: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
    />
  </IconBase>
)

const User: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
    />
  </IconBase>
)

const CpuChip: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z"
    />
  </IconBase>
)

const Sparkles: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
    />
  </IconBase>
)

const ArrowRight: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
  </IconBase>
)

const ArrowLeft: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
  </IconBase>
)

const ArrowUp: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
  </IconBase>
)

const ArrowDown: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
  </IconBase>
)

const ChevronRight: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </IconBase>
)

const ChevronLeft: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
  </IconBase>
)

const ChevronUp: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
  </IconBase>
)

const ChevronDown: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
  </IconBase>
)

const ChevronDoubleRight: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5"
    />
  </IconBase>
)

const ChevronDoubleLeft: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m18.75 4.5-7.5 7.5 7.5 7.5m-6-15L5.25 12l7.5 7.5"
    />
  </IconBase>
)

const ChevronDoubleUp: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 7.5-7.5 7.5 7.5" />
  </IconBase>
)

const ChevronDoubleDown: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m4.5 5.25 7.5 7.5 7.5-7.5m-15 6 7.5 7.5 7.5-7.5"
    />
  </IconBase>
)

const CursorArrowRays: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59"
    />
  </IconBase>
)

const ArrowTopRightOnSquare: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
    />
  </IconBase>
)

const ClipboardDocumentList: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
    />
  </IconBase>
)

const LockClosed: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
    />
  </IconBase>
)

const ArrowPath: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </IconBase>
)

const CheckCircle: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </IconBase>
)

const InformationCircle: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
    />
  </IconBase>
)

const BookOpen: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
    />
  </IconBase>
)

const Clock: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </IconBase>
)

const Photo: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
    />
  </IconBase>
)

const Link: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
    />
  </IconBase>
)

const PlayCircle: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z"
    />
  </IconBase>
)

const Search: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
    />
  </IconBase>
)

const ArrowTrendingUp: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
    />
  </IconBase>
)

const CheckBadge: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
    />
  </IconBase>
)

const XMarkBadge: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5 M21 12c0 1.268-.63 2.39-1.593 3.068 a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043 A3.745 3.745 0 0 1 12 21 c-1.268 0-2.39-.63-3.068-1.593 a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296 A3.745 3.745 0 0 1 3 12 c0-1.268.63-2.39 1.593-3.068 a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043 A3.746 3.746 0 0 1 12 3 c1.268 0 2.39.63 3.068 1.593 a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296 A3.745 3.745 0 0 1 21 12Z"
    />
  </IconBase>
)

const Server: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.75 17.25v-.228a4.5 4.5 0 0 0-.12-1.03l-2.268-9.64a3.375 3.375 0 0 0-3.285-2.602H7.923a3.375 3.375 0 0 0-3.285 2.602l-2.268 9.64a4.5 4.5 0 0 0-.12 1.03v.228m19.5 0a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3m19.5 0a3 3 0 0 0-3-3H5.25a3 3 0 0 0-3 3m16.5 0h.008v.008h-.008v-.008Zm-3 0h.008v.008h-.008v-.008Z"
    />
  </IconBase>
)

const BugAnt: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0 1 12 12.75Zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 0 1-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 0 0 2.248-2.354M12 12.75a2.25 2.25 0 0 1-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 0 0-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 0 1 .4-2.253M12 8.25a2.25 2.25 0 0 0-2.248 2.146M12 8.25a2.25 2.25 0 0 1 2.248 2.146M8.683 5a6.032 6.032 0 0 1-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0 1 15.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 0 0-.575-1.752M4.921 6a24.048 24.048 0 0 0-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 0 1-5.223 1.082"
    />
  </IconBase>
)

const CodeBracket: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
    />
  </IconBase>
)

const XMark: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </IconBase>
)

const CommandLine: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"
    />
  </IconBase>
)

const Play: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
    />
  </IconBase>
)

const PencilSquare: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
    />
  </IconBase>
)

const EllipsisHorizontal: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
    />
  </IconBase>
)

const EllipsisVertical: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
    />
  </IconBase>
)

const EllipsisDoubleHorizontal: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11 9 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0 M18 9 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0 M4 9 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0 M11 15 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0 M18 15 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0 M4 15 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0"
    />
  </IconBase>
)

const EllipsisDoubleVertical: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 11 a1 1 0 1 0 0 2 a1 1 0 1 0 0 -2 M9 4 a1 1 0 1 0 0 2 a1 1 0 1 0 0 -2 M9 18 a1 1 0 1 0 0 2 a1 1 0 1 0 0 -2 M15 11 a1 1 0 1 0 0 2 a1 1 0 1 0 0 -2 M15 4 a1 1 0 1 0 0 2 a1 1 0 1 0 0 -2 M15 18 a1 1 0 1 0 0 2 a1 1 0 1 0 0 -2"
    />
  </IconBase>
)

const Circle: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </IconBase>
)

const Microphone: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
    />
  </IconBase>
)

const Bot: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <rect width="18" height="10" x="3" y="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="5" r="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v4" />
    <line x1="8" x2="8" y1="16" y2="16" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="16" x2="16" y1="16" y2="16" strokeLinecap="round" strokeLinejoin="round" />
  </IconBase>
)

const Type: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20h6" />
  </IconBase>
)

const Loader: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-6.219-8.56" />
  </IconBase>
)

const File: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
  </IconBase>
)

const FileSearch: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v5a1 1 0 0 0 1 1h5" />
    <circle cx="11.5" cy="14.5" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.3 16.3 15 18" />
  </IconBase>
)

const FileText: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 13H8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 17H8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9H8" />
  </IconBase>
)

const BarChart: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 20V10" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 20v-7" />
  </IconBase>
)

const Target: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="2" strokeLinecap="round" strokeLinejoin="round" />
  </IconBase>
)

const Move: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m15 19-3 3-3-3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m19 9 3 3-3 3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m5 9-3 3 3 3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 3-3 3 3" />
  </IconBase>
)

const PanelLeft: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18" />
  </IconBase>
)

const GalleryVerticalEnd: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 2h10" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 6h14" />
    <rect width="18" height="12" x="3" y="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
  </IconBase>
)

const Bolt: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
    />
  </IconBase>
)

const Rekdin: React.FC<IconProps> = (props) => (
  <IconBase fill="currentColor" {...props}>
    <path
      stroke="none"
      d=" M 17.543036874418604 , 4.896270920930232 C 18.41009492093023 , 6.208801562790698 19.26520258604651 , 7.505152520930233 20.12488191627907 , 8.798464744186047  C 20.222368967441863 , 8.945124558139534 20.254394511627908 , 9.071571237209302 20.149504911627904 , 9.231114865116279  C 19.0767759627907 , 10.862770269767442 18.008370027906977 , 12.497266772093024 16.937327386046512 , 14.130029302325582  C 16.902859311627907 , 14.182579702325581 16.85307505116279 , 14.225084037209301 16.759815572093025 , 14.328260148837208  C 13.94524096744186 , 10.090284893023256 11.186158381395348 , 5.852893897674419 8.454422344186046 , 1.6221543627906976  C 8.514305525581396 , 1.464910158139535 8.634233637209302 , 1.4741233674418606 8.726391013953489 , 1.4569233488372093  C 10.579607441860464 , 1.1110618604651161 12.434854213953487 , 0.7759362418604652 14.286372390697673 , 0.42131631627906974  C 14.549253934883719 , 0.3709682790697674 14.67297873488372 , 0.4640710325581395 14.802017860465115 , 0.6646950139534884  C 15.707526362790697 , 2.072506939534884 16.621306102325583 , 3.474997730232558 17.543036874418604 , 4.896270920930232  M 14.929755627906975 , 8.765577320930232  C 15.529929376744187 , 9.679479683720931 16.130103125581396 , 10.593380372093023 16.745446493023255 , 11.530379609302326  C 16.80892191627907 , 11.452698586046512 16.846953376744185 , 11.413716725581395 16.876345618604653 , 11.369052613953489  C 17.32592321860465 , 10.685943181395348 17.762225190697674 , 9.993620539534884 18.229578474418602 , 9.322929934883721  C 18.396635386046512 , 9.08319633488372 18.379578474418604 , 8.90888673488372 18.228454325581396 , 8.679672725581396  C 16.82724608372093 , 6.554368409302326 15.432271981395347 , 4.4249403906976745 14.041729897674418 , 2.2926389023255815  C 13.920580465116279 , 2.1068609302325583 13.790744204651164 , 2.0601170790697676 13.577159776744185 , 2.1048152372093023  C 12.931930213953487 , 2.239848279069767 12.281113730232558 , 2.3480831999999996 11.635490679069768 , 2.4813720558139534  C 11.423474958139535 , 2.5251436465116277 11.194085525581395 , 2.5236890232558142 10.969300186046512 , 2.6724728372093023  C 12.287003776744186 , 4.699400986046512 13.597609674418605 , 6.715410976744186 14.929755627906975 , 8.765577320930232  z"
    />
    <path
      stroke="none"
      d=" M 9.032218046511627 , 13.04658658604651 C 7.462496595348838 , 16.28146576744186 5.902453339534884 , 19.497860651162792 4.3524272372093025 , 22.693608055813954  C 4.188410679069767 , 22.69573038139535 4.136003386046511 , 22.609737209302324 4.074168223255814 , 22.545192111627905  C 2.7682242418604655 , 21.182022139534883 1.4661689302325582 , 19.81510833488372 0.15537906976744187 , 18.4566224372093  C 0.005080967441860465 , 18.30085506976744 0.00006474418604651163 , 18.17748798139535 0.09109797209302326 , 17.992849506976746  C 1.4683662139534883 , 15.199409525581395 2.8431322604651164 , 12.404712502325582 4.206261376744186 , 9.604362195348838  C 4.339177172093023 , 9.331308502325582 4.4963549023255815 , 9.235371460465116 4.8010254139534885 , 9.237779888372092  C 6.689069302325581 , 9.252700855813954 8.577286995348837 , 9.245465246511628 10.465446697674418 , 9.246475311627908  C 10.575429209302325 , 9.246534920930232 10.688278437209302 , 9.229052148837209 10.856270455813954 , 9.305401172093022  C 10.249477674418603 , 10.550409376744186 9.645687795348836 , 11.789254995348838 9.032218046511627 , 13.04658658604651  M 2.2358403906976743 , 17.15991549767442  C 2.1514926697674417 , 17.33579213023256 2.0754264 , 17.516284744186045 1.9805777860465115 , 17.686302027906976  C 1.8763388093023254 , 17.87315134883721 1.8877322232558138 , 18.01362306976744 2.0493862325581396 , 18.175583665116278  C 2.4299202976744185 , 18.55683823255814 2.788204018604651 , 18.960245972093023 3.157264576744186 , 19.353028465116278  C 3.383990065116279 , 19.594329097674418 3.6139909395348835 , 19.832550195348837 3.875492818604651 , 20.106724632558137  C 5.432895962790698 , 17.00355538604651 6.892726883720931 , 13.911048781395348 8.385637730232558 , 10.834192186046511  C 8.247967981395348 , 10.753491237209303 8.134411925581395 , 10.778529823255814 8.026011739534884 , 10.778427627906977  C 7.25461311627907 , 10.777698586046512 6.482904502325582 , 10.793273637209303 5.711967460465116 , 10.77514191627907  C 5.435849469767442 , 10.768647237209303 5.296520706976744 , 10.869665246511627 5.18065328372093 , 11.109392037209302  C 4.210611627906976 , 13.11641871627907 3.230060539534884 , 15.118362809302328 2.2358403906976743 , 17.15991549767442  z"
    />
    <path
      stroke="none"
      d=" M 18.36279069767442 , 16.900471255813954  C 20.12037153488372 , 16.900188502325584 21.850045395348836 , 16.89958894883721 23.579719311627905 , 16.899912558139533  C 23.956235218604654 , 16.899984111627905 23.97350338604651 , 16.9211391627907 23.85051778604651 , 17.282318567441862  C 23.251590865116277 , 19.041238213953488 22.64775164651163 , 20.79849538604651 22.052650325581396 , 22.558706176744188  C 21.981952911627907 , 22.767814325581394 21.870842790697672 , 22.845127423255814 21.647563144186044 , 22.844643683720932  C 18.653197674418603 , 22.838160893023257 15.658811776744187 , 22.838814976744185 12.664436093023255 , 22.842616744186046  C 12.463936465116278 , 22.842868799999998 12.343437711627907 , 22.780500558139536 12.253254474418604 , 22.59081008372093  C 11.41126225116279 , 20.81980035348837 10.547903776744185 , 19.058908297674417 9.743065841860465 , 17.270388558139533  C 9.698846288372092 , 17.172121395348835 9.632006846511628 , 17.07668511627907 9.651867404651163 , 16.900484874418606  C 12.544891199999999 , 16.900484874418606 15.43988578604651 , 16.900484874418606 18.36279069767442 , 16.900471255813954  M 21.00817244651163 , 20.81729648372093  C 21.264932316279072 , 20.05439564651163 21.52169559069767 , 19.291494809302325 21.78492457674419 , 18.50937728372093  C 18.52010466976744 , 18.50937728372093 15.294477879069769 , 18.50937728372093 12.070472595348837 , 18.50937728372093  C 12.055432409302325 , 18.630877562790698 12.10017488372093 , 18.704341172093024 12.135273209302325 , 18.77875183255814  C 12.48825968372093 , 19.52704850232558 12.849888725581394 , 20.27138673488372 13.192260167441859 , 21.0244935627907  C 13.291964930232558 , 21.243814716279072 13.424233506976744 , 21.315803274418606 13.661933358139535 , 21.3148392  C 15.903171572093024 , 21.30574353488372 18.144460855813954 , 21.31059454883721 20.385726306976743 , 21.30574353488372  C 20.865942976744186 , 21.304704558139534 20.818550120930233 , 21.40274684651163 21.00817244651163 , 20.81729648372093  z"
    />
  </IconBase>
)

const GitHub: React.FC<IconProps> = (props) => (
  <IconBase fill="currentColor" stroke="none" {...props}>
    <path d="M12,2.2467A10.00042,10.00042,0,0,0,8.83752,21.73419c.5.08752.6875-.21247.6875-.475,0-.23749-.01251-1.025-.01251-1.86249C7,19.85919,6.35,18.78423,6.15,18.22173A3.636,3.636,0,0,0,5.125,16.8092c-.35-.1875-.85-.65-.01251-.66248A2.00117,2.00117,0,0,1,6.65,17.17169a2.13742,2.13742,0,0,0,2.91248.825A2.10376,2.10376,0,0,1,10.2,16.65923c-2.225-.25-4.55-1.11254-4.55-4.9375a3.89187,3.89187,0,0,1,1.025-2.6875,3.59373,3.59373,0,0,1,.1-2.65s.83747-.26251,2.75,1.025a9.42747,9.42747,0,0,1,5,0c1.91248-1.3,2.75-1.025,2.75-1.025a3.59323,3.59323,0,0,1,.1,2.65,3.869,3.869,0,0,1,1.025,2.6875c0,3.83747-2.33752,4.6875-4.5625,4.9375a2.36814,2.36814,0,0,1,.675,1.85c0,1.33752-.01251,2.41248-.01251,2.75,0,.26251.1875.575.6875.475A10.0053,10.0053,0,0,0,12,2.2467Z" />
  </IconBase>
)

const Torus: React.FC<IconProps> = (props) => (
  <IconBase fill="currentColor" {...props}>
    <ellipse cx="12" cy="11" rx="3" ry="2" />
    <ellipse cx="12" cy="12.5" rx="10" ry="8.5" />
  </IconBase>
)

type ContextUsageRingIconProps = IconProps & {
  radius: number
  circumference: number
  strokeDashoffset: number
}

const ContextUsageRing: React.FC<ContextUsageRingIconProps> = ({
  radius,
  circumference,
  strokeDashoffset,
  className,
  ...props
}) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <circle
      cx="10"
      cy="10"
      r={radius}
      strokeWidth="2"
      stroke="currentColor"
      className="opacity-20"
    />
    <circle
      cx="10"
      cy="10"
      r={radius}
      strokeWidth="2"
      stroke="currentColor"
      strokeDasharray={circumference}
      strokeDashoffset={strokeDashoffset}
      strokeLinecap="round"
    />
  </svg>
)

const LightboxZoomIn: React.FC<IconProps> = (props) => (
  <IconBase strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
  </IconBase>
)

const LightboxZoomOut: React.FC<IconProps> = (props) => (
  <IconBase strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35M8 11h6" />
  </IconBase>
)

const LightboxRotate: React.FC<IconProps> = (props) => (
  <IconBase strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </IconBase>
)

const LightboxReset: React.FC<IconProps> = (props) => (
  <IconBase strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </IconBase>
)

const LightboxDownload: React.FC<IconProps> = (props) => (
  <IconBase strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </IconBase>
)

const LightboxClose: React.FC<IconProps> = (props) => (
  <IconBase strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </IconBase>
)

const FolderTree: React.FC<IconProps & { open?: boolean }> = ({ open, ...props }) => (
  <IconBase viewBox="0 0 16 16" fill="currentColor" stroke="none" {...props}>
    {open ? (
      <path d="M1.5 3A1.5 1.5 0 0 0 0 4.5v8A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 14.5 5H7.621a1.5 1.5 0 0 1-1.06-.44L5.5 3.5A1.5 1.5 0 0 0 4.44 3H1.5Z" />
    ) : (
      <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.19a2 2 0 0 1 1.345.513l.984.86A1 1 0 0 0 8.71 2.5H13.5A1.5 1.5 0 0 1 15 4v.63l.54.44A.5.5 0 0 1 16 5.5v8a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .04-.13ZM1.5 4h13v8h-13V4Z" />
    )}
  </IconBase>
)

const NpmLogo: React.FC<IconProps> = (props) => (
  <IconBase viewBox="0 0 64 64" stroke="none" {...props}>
    <path
      d="M12 26h40v13.333H32v2.223h-8.889v-2.223H12V26zm2.222 11.111h4.445v-6.667h2.222v6.667h2.222v-8.889h-8.889v8.89zm11.111-8.889v11.111h4.445v-2.222h4.444v-8.889h-8.889zm4.445 2.222H32v4.445h-2.222v-4.445zm6.666-2.222v8.89h4.445v-6.668h2.222v6.667h2.222v-6.667h2.223v6.667h2.222v-8.889H36.444z"
      fill="#CB3837"
    />
  </IconBase>
)

type BrowserDragOverlayIconProps = React.SVGProps<SVGSVGElement> & {
  width: number
  height: number
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  markerId?: string
  color?: string
  strokeWidth?: number
  sourceRadius?: number
  targetRadius?: number
  markerWidth?: number
  markerHeight?: number
  markerRefX?: number
  markerRefY?: number
  markerPath?: string
}

const BrowserDragOverlay: React.FC<BrowserDragOverlayIconProps> = ({
  width,
  height,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerId = "drag-arrow",
  color = "var(--tool-action)",
  strokeWidth = 3,
  sourceRadius = 5,
  targetRadius = 5,
  markerWidth = 8,
  markerHeight = 8,
  markerRefX = 6,
  markerRefY = 4,
  markerPath = "M0,0 L8,4 L0,8 z",
  ...props
}) => (
  <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" {...props}>
    <defs>
      <marker
        id={markerId}
        markerWidth={markerWidth}
        markerHeight={markerHeight}
        refX={markerRefX}
        refY={markerRefY}
        orient="auto"
      >
        <path d={markerPath} fill={color} opacity="0.8" />
      </marker>
    </defs>
    <line
      x1={sourceX}
      y1={sourceY}
      x2={targetX}
      y2={targetY}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      markerEnd={`url(#${markerId})`}
      opacity="0.8"
    />
    <circle cx={sourceX} cy={sourceY} r={sourceRadius} fill={color} opacity="0.9" />
    <circle cx={targetX} cy={targetY} r={targetRadius} fill={color} opacity="0.6" />
  </svg>
)

type SafariIconSvgProps = {
  viewBox: string
  children: React.ReactNode
  className?: string
}

const SafariIconSvg: React.FC<SafariIconSvgProps> = ({ viewBox, children, className = "" }) => (
  <svg
    className={["shrink-0 mix-blend-luminosity", className].join(" ")}
    width="18"
    height="18"
    viewBox={viewBox}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const SafariIconLock: React.FC = () => (
  <SafariIconSvg viewBox="565 19 9 14" className="h-4 w-4">
    <path
      d="M566.269 32.0852H572.426C573.277 32.0852 573.696 31.6663 573.696 30.7395V25.9851C573.696 25.1472 573.353 24.7219 572.642 24.6521V23.0842C572.642 20.6721 571.036 19.5105 569.348 19.5105C567.659 19.5105 566.053 20.6721 566.053 23.0842V24.6711C565.393 24.7727 565 25.1917 565 25.9851V30.7395C565 31.6663 565.418 32.0852 566.269 32.0852ZM567.272 22.97C567.272 21.491 568.211 20.6785 569.348 20.6785C570.478 20.6785 571.423 21.491 571.423 22.97V24.6394L567.272 24.6458V22.97Z"
      fill="#A3A3A3"
    />
  </SafariIconSvg>
)

const SafariIconShield: React.FC = () => (
  <SafariIconSvg viewBox="258 18 15 17">
    <path
      d="M265.5 33.8984C265.641 33.8984 265.852 33.8516 266.047 33.7422C270.547 31.2969 272.109 30.1641 272.109 27.3203V21.4219C272.109 20.4844 271.742 20.1484 270.961 19.8125C270.094 19.4453 267.18 18.4297 266.328 18.1406C266.07 18.0547 265.766 18 265.5 18C265.234 18 264.93 18.0703 264.672 18.1406C263.82 18.3828 260.906 19.4531 260.039 19.8125C259.258 20.1406 258.891 20.4844 258.891 21.4219V27.3203C258.891 30.1641 260.461 31.2812 264.945 33.7422C265.148 33.8516 265.359 33.8984 265.5 33.8984ZM265.922 19.5781C266.945 19.9766 269.172 20.7656 270.344 21.1875C270.562 21.2656 270.617 21.3828 270.617 21.6641V27.0234C270.617 29.3125 269.469 29.9375 265.945 32.0625C265.727 32.1875 265.617 32.2344 265.508 32.2344V19.4844C265.617 19.4844 265.734 19.5156 265.922 19.5781Z"
      fill="#A3A3A3"
    />
  </SafariIconSvg>
)

const SafariIconRefresh: React.FC = () => (
  <SafariIconSvg viewBox="929 16 15 19">
    <path
      d="M936.273 24.9766C936.5 24.9766 936.68 24.9062 936.82 24.7578L940.023 21.5312C940.195 21.3594 940.273 21.1719 940.273 20.9531C940.273 20.7422 940.188 20.5391 940.023 20.3828L936.82 17.125C936.68 16.9688 936.5 16.8906 936.273 16.8906C935.852 16.8906 935.516 17.2422 935.516 17.6719C935.516 17.8828 935.594 18.0547 935.727 18.2031L937.594 20.0312C937.227 19.9766 936.852 19.9453 936.477 19.9453C932.609 19.9453 929.516 23.0391 929.516 26.9141C929.516 30.7891 932.633 33.9062 936.5 33.9062C940.375 33.9062 943.484 30.7891 943.484 26.9141C943.484 26.4453 943.156 26.1094 942.688 26.1094C942.234 26.1094 941.93 26.4453 941.93 26.9141C941.93 29.9297 939.516 32.3516 936.5 32.3516C933.492 32.3516 931.07 29.9297 931.07 26.9141C931.07 23.875 933.469 21.4688 936.477 21.4688C936.984 21.4688 937.453 21.5078 937.867 21.5781L935.734 23.6875C935.594 23.8281 935.516 24 935.516 24.2109C935.516 24.6406 935.852 24.9766 936.273 24.9766Z"
      fill="#A3A3A3"
    />
  </SafariIconSvg>
)

const SafariIconPlus: React.FC = () => (
  <SafariIconSvg viewBox="1127 19 14 15">
    <path
      d="M1134 33.0156C1134.49 33.0156 1134.89 32.6094 1134.89 32.1484V27.2578H1139.66C1140.13 27.2578 1140.54 26.8594 1140.54 26.3672C1140.54 25.8828 1140.13 25.4766 1139.66 25.4766H1134.89V20.5859C1134.89 20.1172 1134.49 19.7188 1134 19.7188C1133.52 19.7188 1133.11 20.1172 1133.11 20.5859V25.4766H1128.34C1127.88 25.4766 1127.46 25.8828 1127.46 26.3672C1127.46 26.8594 1127.88 27.2578 1128.34 27.2578H1133.11V32.1484C1133.11 32.6094 1133.52 33.0156 1134 33.0156Z"
      fill="#A3A3A3"
    />
  </SafariIconSvg>
)

const SafariIconTabs: React.FC = () => (
  <SafariIconSvg viewBox="1159 17 18 18">
    <path
      d="M1161.8 31.0703H1163.23V32.375C1163.23 34.0547 1164.12 34.9219 1165.81 34.9219H1174.2C1175.89 34.9219 1176.77 34.0547 1176.77 32.3828V24.0469C1176.77 22.375 1175.89 21.5 1174.2 21.5H1172.77V20.2578C1172.77 18.5859 1171.88 17.7109 1170.19 17.7109H1161.8C1160.1 17.7109 1159.23 18.5781 1159.23 20.2578V28.5234C1159.23 30.1953 1160.1 31.0703 1161.8 31.0703ZM1161.9 29.5078C1161.18 29.5078 1160.78 29.1328 1160.78 28.3828V20.3984C1160.78 19.6406 1161.18 19.2656 1161.9 19.2656H1170.09C1170.8 19.2656 1171.2 19.6406 1171.2 20.3984V21.5H1165.81C1164.12 21.5 1163.23 22.375 1163.23 24.0469V29.5078H1161.9ZM1165.91 33.3672C1165.19 33.3672 1164.8 32.9922 1164.8 32.2422V24.1875C1164.8 23.4297 1165.19 23.0625 1165.91 23.0625H1174.1C1174.81 23.0625 1175.21 23.4297 1175.21 24.1875V32.2422C1175.21 32.9922 1174.81 33.3672 1174.1 33.3672H1165.91Z"
      fill="#A3A3A3"
    />
  </SafariIconSvg>
)

const SafariIconShare: React.FC = () => (
  <SafariIconSvg viewBox="1092 16 15 19">
    <path
      d="M1099.51 28.4141C1099.91 28.4141 1100.24 28.0859 1100.24 27.6953V19.8359L1100.18 18.6797L1100.66 19.25L1101.75 20.4141C1101.88 20.5547 1102.24 20.625 1102.24 20.625C1102.6 20.625 1102.9 20.3672 1102.9 20C1102.9 19.8047 1102.82 19.6641 1102.69 19.5312L1100.06 17.0078C1099.88 16.8203 1099.7 16.7578 1099.51 16.7578C1099.32 16.7578 1099.14 16.8203 1098.95 17.0078L1096.33 19.5312C1096.2 19.6641 1096.12 19.8047 1096.12 20C1096.12 20.3672 1096.41 20.625 1096.77 20.625C1096.95 20.625 1097.14 20.5547 1097.27 20.4141L1098.35 19.25L1098.84 18.6719L1098.78 19.8359V27.6953C1098.78 28.0859 1099.11 28.4141 1099.51 28.4141ZM1095 34.6562H1104C1105.7 34.6562 1106.57 33.7812 1106.57 32.1094V24.4297C1106.57 22.7578 1105.7 21.8828 1104 21.8828H1101.89V23.4375H1103.9C1104.61 23.4375 1105.02 23.8125 1105.02 24.5625V31.9688C1105.02 32.7188 1104.61 33.0938 1103.9 33.0938H1095.1C1094.38 33.0938 1093.98 32.7188 1093.98 31.9688V24.5625C1093.98 23.8125 1094.38 23.4375 1095.1 23.4375H1097.13V21.8828H1095C1093.31 21.8828 1092.43 22.75 1092.43 24.4297V32.1094C1092.43 33.7812 1093.31 34.6562 1095 34.6562Z"
      fill="#A3A3A3"
    />
  </SafariIconSvg>
)

const SafariIconSidebar: React.FC = () => (
  <SafariIconSvg viewBox="97 19 19 15">
    <path
      d="M99.5703 33.6016H112.938C114.633 33.6016 115.516 32.7266 115.516 31.0547V21.5469C115.516 19.875 114.633 19 112.938 19H99.5703C97.8828 19 97 19.8672 97 21.5469V31.0547C97 32.7266 97.8828 33.6016 99.5703 33.6016ZM99.6719 32.0469C98.9531 32.0469 98.5547 31.6719 98.5547 30.9141V21.6875C98.5547 20.9297 98.9531 20.5547 99.6719 20.5547H103.234V32.0469H99.6719ZM112.836 20.5547C113.555 20.5547 113.953 20.9297 113.953 21.6875V30.9141C113.953 31.6719 113.555 32.0469 112.836 32.0469H104.711V20.5547H112.836ZM101.703 23.4141C101.984 23.4141 102.219 23.1719 102.219 22.9062C102.219 22.6406 101.984 22.4062 101.703 22.4062H100.102C99.8203 22.4062 99.5859 22.6406 99.5859 22.9062C99.5859 23.1719 99.8203 23.4141 100.102 23.4141H101.703ZM101.703 25.5156C101.984 25.5156 102.219 25.2812 102.219 25.0078C102.219 24.7422 101.984 24.5078 101.703 24.5078H100.102C99.8203 24.5078 99.5859 24.7422 99.5859 25.0078C99.5859 25.2812 99.8203 25.5156 100.102 25.5156H101.703ZM101.703 27.6094C101.984 27.6094 102.219 27.3828 102.219 27.1094C102.219 26.8438 101.984 26.6172 101.703 26.6172H100.102C99.8203 26.6172 99.5859 26.8438 99.5859 27.1094C99.5859 27.3828 99.8203 27.6094 100.102 27.6094H101.703Z"
      fill="#A3A3A3"
    />
  </SafariIconSvg>
)

const SafariIconBack: React.FC = () => (
  <SafariIconSvg viewBox="137 19 9 14">
    <path
      d="M143.914 32.5938C144.094 32.7656 144.312 32.8594 144.562 32.8594C145.086 32.8594 145.492 32.4531 145.492 31.9375C145.492 31.6797 145.391 31.4453 145.211 31.2656L139.742 25.9219L145.211 20.5938C145.391 20.4141 145.492 20.1719 145.492 19.9219C145.492 19.4062 145.086 19 144.562 19C144.312 19 144.094 19.0938 143.922 19.2656L137.844 25.2031C137.625 25.4062 137.516 25.6562 137.516 25.9297C137.516 26.2031 137.625 26.4375 137.836 26.6484L143.914 32.5938Z"
      fill="#A3A3A3"
    />
  </SafariIconSvg>
)

const SafariIconForward: React.FC = () => (
  <SafariIconSvg viewBox="167 19 9 14">
    <path
      d="M168.422 32.8594C168.68 32.8594 168.891 32.7656 169.07 32.5938L175.148 26.6562C175.359 26.4375 175.469 26.2109 175.469 25.9297C175.469 25.6562 175.367 25.4141 175.148 25.2109L169.07 19.2656C168.891 19.0938 168.68 19 168.422 19C167.898 19 167.492 19.4062 167.492 19.9219C167.492 20.1719 167.602 20.4141 167.773 20.5938L173.25 25.9375L167.773 31.2656C167.594 31.4531 167.492 31.6797 167.492 31.9375C167.492 32.4531 167.898 32.8594 168.422 32.8594Z"
      fill="#A3A3A3"
    />
  </SafariIconSvg>
)

export {
  ArrowDown,
  ArrowDown as ArrowDownIcon,
  ArrowDownTray,
  ArrowDownTray as ArrowDownTrayIcon,
  ArrowLeft,
  ArrowLeft as ArrowLeftIcon,
  ArrowPath,
  ArrowPath as ArrowPathIcon,
  ArrowRight,
  ArrowRight as ArrowRightIcon,
  ArrowTopRightOnSquare,
  ArrowTopRightOnSquare as ArrowTopRightOnSquareIcon,
  ArrowTrendingUp,
  ArrowTrendingUp as ArrowTrendingUpIcon,
  ArrowUp,
  ArrowUp as ArrowUpIcon,
  ArrowUpTray,
  ArrowUpTray as ArrowUpTrayIcon,
  BarChart,
  BarChart as BarChartIcon,
  Bolt,
  Bolt as BoltIcon,
  BookOpen,
  BookOpen as BookOpenIcon,
  Bot,
  Bot as BotIcon,
  BrowserDragOverlay,
  BrowserDragOverlay as BrowserDragOverlayIcon,
  BugAnt,
  BugAnt as BugAntIcon,
  Check,
  CheckBadge,
  CheckBadge as CheckBadgeIcon,
  CheckCircle,
  CheckCircle as CheckCircleIcon,
  Check as CheckIcon,
  ChevronDoubleDown,
  ChevronDoubleDown as ChevronDoubleDownIcon,
  ChevronDoubleLeft,
  ChevronDoubleLeft as ChevronDoubleLeftIcon,
  ChevronDoubleRight,
  ChevronDoubleRight as ChevronDoubleRightIcon,
  ChevronDoubleUp,
  ChevronDoubleUp as ChevronDoubleUpIcon,
  ChevronDown,
  ChevronDown as ChevronDownIcon,
  ChevronLeft,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  ChevronUp,
  ChevronUp as ChevronUpIcon,
  Circle,
  Circle as CircleIcon,
  ClipboardDocumentList,
  ClipboardDocumentList as ClipboardDocumentListIcon,
  Clock,
  Clock as ClockIcon,
  CodeBracket,
  CodeBracket as CodeBracketIcon,
  Cog,
  Cog6Tooth,
  Cog6Tooth as Cog6ToothIcon,
  Cog8Tooth,
  Cog8Tooth as Cog8ToothIcon,
  Cog as CogIcon,
  CommandLine,
  CommandLine as CommandLineIcon,
  ContextUsageRing,
  ContextUsageRing as ContextUsageRingIcon,
  CpuChip,
  CpuChip as CpuChipIcon,
  CursorArrowRays,
  CursorArrowRays as CursorArrowRaysIcon,
  EllipsisDoubleHorizontal,
  EllipsisDoubleHorizontal as EllipsisDoubleHorizontalIcon,
  EllipsisDoubleVertical,
  EllipsisDoubleVertical as EllipsisDoubleVerticalIcon,
  EllipsisHorizontal,
  EllipsisHorizontal as EllipsisHorizontalIcon,
  EllipsisVertical,
  EllipsisVertical as EllipsisVerticalIcon,
  ExclamationCircle,
  ExclamationCircle as ExclamationCircleIcon,
  Eye,
  Eye as EyeIcon,
  EyeSlash,
  EyeSlash as EyeSlashIcon,
  File,
  File as FileIcon,
  FileSearch,
  FileSearch as FileSearchIcon,
  FileText,
  FileText as FileTextIcon,
  FolderTree,
  FolderTree as FolderTreeIcon,
  GalleryVerticalEnd,
  GalleryVerticalEnd as GalleryVerticalEndIcon,
  GitHub,
  GitHub as GitHubIcon,
  Globe,
  Globe as GlobeIcon,
  IconBase,
  InformationCircle,
  InformationCircle as InformationCircleIcon,
  LightboxClose,
  LightboxClose as LightboxCloseIcon,
  LightboxDownload,
  LightboxDownload as LightboxDownloadIcon,
  LightboxReset,
  LightboxReset as LightboxResetIcon,
  LightboxRotate,
  LightboxRotate as LightboxRotateIcon,
  LightboxZoomIn,
  LightboxZoomIn as LightboxZoomInIcon,
  LightboxZoomOut,
  LightboxZoomOut as LightboxZoomOutIcon,
  Link,
  Link as LinkIcon,
  Loader,
  Loader as LoaderIcon,
  LockClosed,
  LockClosed as LockClosedIcon,
  Microphone,
  Microphone as MicrophoneIcon,
  Minus,
  Minus as MinusIcon,
  Moon,
  Moon as MoonIcon,
  Move,
  Move as MoveIcon,
  NpmLogo,
  NpmLogo as NpmLogoIcon,
  PanelLeft,
  PanelLeft as PanelLeftIcon,
  PaperAirplane,
  PaperAirplane as PaperAirplaneIcon,
  PaperClip,
  PaperClip as PaperClipIcon,
  PencilSquare,
  PencilSquare as PencilSquareIcon,
  Photo,
  Photo as PhotoIcon,
  Play,
  PlayCircle,
  PlayCircle as PlayCircleIcon,
  Play as PlayIcon,
  Plus,
  Plus as PlusIcon,
  Rekdin,
  Rekdin as RekdinIcon,
  SafariIconBack,
  SafariIconBack as SafariIconBackIcon,
  SafariIconForward,
  SafariIconForward as SafariIconForwardIcon,
  SafariIconLock,
  SafariIconLock as SafariIconLockIcon,
  SafariIconPlus,
  SafariIconPlus as SafariIconPlusIcon,
  SafariIconRefresh,
  SafariIconRefresh as SafariIconRefreshIcon,
  SafariIconShare,
  SafariIconShare as SafariIconShareIcon,
  SafariIconShield,
  SafariIconShield as SafariIconShieldIcon,
  SafariIconSidebar,
  SafariIconSidebar as SafariIconSidebarIcon,
  SafariIconTabs,
  SafariIconTabs as SafariIconTabsIcon,
  Search,
  Search as SearchIcon,
  Server,
  Server as ServerIcon,
  Sparkles,
  Sparkles as SparklesIcon,
  Sun,
  Sun as SunIcon,
  Target,
  Target as TargetIcon,
  Torus,
  Torus as TorusIcon,
  Trash,
  Trash as TrashIcon,
  Type,
  Type as TypeIcon,
  User,
  User as UserIcon,
  XMark,
  XMarkBadge,
  XMarkBadge as XMarkBadgeIcon,
  XMark as XMarkIcon,
}
