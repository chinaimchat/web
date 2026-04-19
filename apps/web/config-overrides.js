var path = require('path');
const { override, babelInclude, addWebpackPlugin, overrideDevServer } = require('customize-cra')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const TerserPlugin = require("terser-webpack-plugin");
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');

const addDevServerConfig = () => config => {
  return {
    ...config,
    client: {
      overlay: false
    }
  };
}

module.exports = {
  webpack: function (config, env) {
    if (process.env.NODE_ENV === 'production') {
      config.devtool = false;
    }
    // 注意：不要在这里写 publicPath，见文件末尾（必须在 override 之后，否则会被 CRA 覆盖，
    // Electron loadFile(file://) 下异步 chunk 常变成 file:///static/... 导致「f 开头 chunk 未引入」类 404）
    if (env === 'production') {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        minimizer: [new TerserPlugin()],
      };
    }
    const packagesDir = path.resolve(__dirname, '../../packages');
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@tsdaodao/sticker': path.join(packagesDir, 'tsdaodaosticker/src'),
      '@tsdaodao/sticker/*': path.join(packagesDir, 'tsdaodaosticker/src'),
    };
    const result = Object.assign(
      config,
      override(
        // 判断环境变量ANALYZER参数的值
        process.env.ANALYZER && addWebpackPlugin(new BundleAnalyzerPlugin()),
        babelInclude([
          /* transpile (converting to es5) code in src/ and shared component library */
          path.resolve('src'),
          path.resolve('../../packages'),
        ])
      )(config, env)
    );
    // 放宽 ModuleScopePlugin：允许引用 packages/tsdaodaosticker/src（CRA 默认禁止 src 外引用）
    const resolvePlugins = result.resolve && result.resolve.plugins;
    if (Array.isArray(resolvePlugins)) {
      const idx = resolvePlugins.findIndex(
        (p) => p && p.constructor && p.constructor.name === 'ModuleScopePlugin'
      );
      if (idx !== -1) {
        const old = resolvePlugins[idx];
        const stickerSrcDir = path.resolve(__dirname, '../../packages/tsdaodaosticker/src');
        const newAllowed = old.allowedFiles ? Array.from(old.allowedFiles) : [];
        newAllowed.push(path.join(stickerSrcDir, 'index.js'));
        resolvePlugins[idx] = new ModuleScopePlugin(old.appSrcs[0], newAllowed);
      }
    }
    // Webpack5 + Electron：异步 chunk 名多为 [id].[contenthash].js（hash 常以 a-f 开头，看起来像「f 开头资源」）
    // publicPath 必须在 customize-cra 处理完 output 之后再锁一次，否则动态 import 的 chunk 路径会错。
    result.output = result.output || {};
    result.output.publicPath = 'auto';
    return result;
  },
  devServer: overrideDevServer(addDevServerConfig())
}