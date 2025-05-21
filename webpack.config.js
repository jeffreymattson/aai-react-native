const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync({
    ...env,
    babel: {
      dangerouslyAddModulePathsToTranspile: ['@rneui/themed', '@rneui/base']
    }
  }, argv);
  
  // Add custom configuration for server deployment
  config.resolve.alias = {
    ...config.resolve.alias,
    'react/jsx-runtime': require.resolve('react/jsx-runtime'),
    'react-native$': 'react-native-web'
  };

  // Ensure proper JSX handling
  config.module.rules.push({
    test: /\.(js|jsx|ts|tsx)$/,
    exclude: /node_modules/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-react'],
        plugins: [
          ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]
        ]
      }
    }
  });

  return config;
};