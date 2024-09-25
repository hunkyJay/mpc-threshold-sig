const webpack = require('webpack');

module.exports = function override(config, env) {
    // 添加fallback配置以包括buffer库
    config.resolve.fallback = {
        ...config.resolve.fallback, // 保持已有的fallback配置
        crypto: require.resolve('crypto-browserify'),
        os: require.resolve('os-browserify/browser'),
        path: require.resolve('path-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/') // 添加buffer到fallback
    };

    // 添加ProvidePlugin配置以全局提供Buffer对象
    config.plugins = [
        ...(config.plugins || []),
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer'], // 添加这行来提供Buffer
        }),
    ];

    return config;
};
