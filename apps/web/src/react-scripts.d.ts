/**
 * react-scripts 在部分安装形态下不会提供独立的 `@types/react-scripts` 包。
 * CRA 模板里的 `/// <reference types="react-scripts" />` 会导致编辑器找不到类型。
 * 这里提供一个最小占位声明，避免 TS 语言服务报红（不影响运行时）。
 */
declare module "react-scripts" {}
