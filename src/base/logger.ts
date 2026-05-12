import chalk from 'chalk';
import moment from 'moment';

const { green, cyan, yellow, red, gray, bold, dim } = chalk;

function formatError(e: unknown): string {
    if (e instanceof Error) return e.stack ?? e.message;
    return String(e);
}

function stamp(): string {
    return dim(`[${moment().format('L LTS')}]`);
}

export default class Logger {
    static line(): void {
        const cols =
            typeof process !== 'undefined' && process.stdout?.columns ? Math.min(process.stdout.columns, 80) : 72;
        console.log(dim('─'.repeat(cols)));
    }

    static header(title: string, subtitle?: string): void {
        Logger.line();
        console.log(`${stamp()} ${bold.cyan(title)}`);
        if (subtitle) console.log(`${stamp()} ${gray(subtitle)}`);
        Logger.line();
    }

    static success(content: string): void {
        console.log(`${stamp()} ( ${green(bold('SUCCESS'))} ) ${cyan(content)}`);
    }

    static debug(content: string): void {
        console.log(`${stamp()} ( ${green('DEBUG')} ) ${cyan(content)}`);
    }

    static log(content: string): void {
        console.log(`${stamp()} ( ${cyan('LOG')} ) ${cyan(content)}`);
    }

    static warn(content: string, options?: { error?: unknown }): void {
        console.log(`${stamp()} ( ${yellow(bold('WARN'))} ) ${cyan(content)}`);
        if (options?.error !== undefined) {
            console.log(`${stamp()} ${dim(formatError(options.error))}`);
        }
    }

    static error(content: string, options?: { error?: unknown }): void {
        console.log(`${stamp()} ( ${red(bold('ERROR'))} ) ${cyan(content)}`);
        if (options?.error !== undefined) {
            console.log(`${stamp()} ${dim(formatError(options.error))}`);
        }
    }

    static loaded(client: { user: { tag: string } | null | undefined }): void {
        const tag = client.user?.tag ?? 'bilinmiyor';
        console.log(`${stamp()} ( ${green(bold('READY'))} ) ${cyan(`@${tag}`)} ${gray('Discord oturumu açık.')}`);
    }
}
