const path = require('path');
const { copySync } = require('fs-extra-promise');
const webpack = require('webpack'); // 添加这行
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

function copyInfoToDist() {
  const sourcePath = path.join(__dirname, 'info');
  const targetPath = path.join(__dirname, 'dist');
  copySync(sourcePath, targetPath, {
    overwrite: true,
    recursive: true,
  });
}

copyInfoToDist();

module.exports = {
  optimization: {
    minimize: false,
  },
  entry: {
    popup: path.join(__dirname, 'src/popup/index.tsx'),
    inject: path.join(__dirname, 'src/inject.ts'),
    background: path.join(__dirname, 'src/background.ts'),
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'js/[name].js',
    library: 'HtmlToFigmaExtension', // 改为字符串格式
    libraryTarget: 'umd',            // 单独设置模块格式
    globalObject: 'self'
  },
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.tsx?$/,
        use: 'ts-loader',
      },
      {
        exclude: /node_modules/,
        test: /\.scss$/,
        use: [
          {
            loader: 'style-loader', // Creates style nodes from JS strings
          },
          {
            loader: 'css-loader', // Translates CSS into CommonJS
          },
          {
            loader: 'sass-loader', // Compiles Sass to CSS
          },
        ],
      },
      {
        test: /\.(png|jpg|gif|webp|svg)$/,
        loader: 'url-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      // 添加模块别名解析
      '@builder.io/html-to-figma': path.resolve(__dirname, 'node_modules/@builder.io/html-to-figma')
    }
  },
  // 在 plugins 部分添加 ProvidePlugin 配置
  plugins: [
    new webpack.ProvidePlugin({
      'window.htmlToFigma': '@builder.io/html-to-figma/dist/browser'
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src/popup/index.html'),
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/manifest.json'),
          to: path.resolve(__dirname, 'dist/manifest.json'),
        },
        // 若还有其他静态资源需要复制，可在此添加新的 pattern
      ],
    }),
  ],
};
