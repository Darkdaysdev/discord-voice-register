import Discord from 'discord.js';
import { settings } from '@/config/settings';
import Logger from '@/base/logger';
let activityIndex = 0;
export class Client extends Discord.Client implements Discord.Client {
    constructor() {
        super({
            intents: Object.values(Discord.GatewayIntentBits) as Discord.GatewayIntentBits[],
            partials: Object.values(Discord.Partials) as Discord.Partials[],
            ws: { version: 10 },
            rest: { version: '10', hashLifetime: Infinity, rejectOnRateLimit: [] },
            presence: {
                activities: settings.Welcome.botActivity.map((activity, index) => ({
                    name: activity,
                    type:
                        (Discord.ActivityType as any)[settings.Welcome.botActivityType[index]] ||
                        Discord.ActivityType.Playing,
                })),
                status: (settings.Welcome.botStatus[0] || 'dnd') as 'online' | 'idle' | 'dnd' | 'invisible',
            },
        });
    }
    static async BotLogin(token: string, client: Client, process: any) {
        await client.login(token).catch((err: unknown) => {
            Logger.error(`[${process}] Bot girişi başarısız`, { error: err });
        });
        client.on(Discord.Events.ClientReady, async () => {
            try {
                const guild = client.guilds.cache.get(settings.Welcome.guildID) as Discord.Guild;
                if (!guild) {
                    Logger.error(`[${process}] Sunucu bulunamadı`);
                    return;
                }
                Logger.loaded(client);
                await guild.members.fetch();
                await guild.channels.fetch();
                await guild.roles.fetch();
                setInterval(
                    async () => {
                        await guild.members.fetch();
                        await guild.channels.fetch();
                        await guild.roles.fetch();
                    },
                    1000 * 60 * 30,
                );
                setInterval(() => {
                    activityIndex = (activityIndex + 1) % settings.Welcome.botActivity.length;
                    const statusIndex = activityIndex % settings.Welcome.botStatus.length;
                    client.user?.setPresence({
                        activities: [
                            {
                                name: settings.Welcome.botActivity[activityIndex],
                                type:
                                    (Discord.ActivityType as any)[settings.Welcome.botActivityType[activityIndex]] ||
                                    Discord.ActivityType.Playing,
                                url: 'https://www.twitch.tv/darkdaysxd',
                            },
                        ],
                        status: (settings.Welcome.botStatus[statusIndex] || 'dnd') as
                            | 'online'
                            | 'idle'
                            | 'dnd'
                            | 'invisible',
                    });
                }, 10000);
            } catch (error) {
                Logger.error(`[${process}] ClientReady`, { error });
            }
        });
    }
}
