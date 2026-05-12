module.exports = {
    apps: [
        {
            name: 'Welcome',
            script: 'src/app/index.ts',
            cwd: __dirname,
            interpreter: 'node',
            interpreter_args: '--require ts-node/register --require tsconfig-paths/register',
            exec_mode: 'cluster',
            watch: false,
            max_memory_restart: '2G',
        },
    ],
};
