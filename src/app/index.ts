import path from 'path';
import fs from 'fs';
import os from 'os';
import Discord from 'discord.js';
import {
    AudioPlayerStatus,
    EndBehaviorType,
    NoSubscriberBehavior,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    joinVoiceChannel,
    type AudioPlayer,
    type VoiceConnection,
} from '@discordjs/voice';
import { Client } from '@/base/client';
import Logger from '@/base/logger';
import { settings } from '@/config/settings';
import { execSync } from 'child_process';
import * as prism from 'prism-media';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface FindcordData {
    topName: string | null;
    topAge: string | null;
    topSex: 'erkek' | 'kadın' | null;
    punishments: any[];
    guilds: any[];
}

interface QueueItem {
    member: Discord.GuildMember;
    channel: Discord.VoiceChannel;
}

const queue: QueueItem[] = [];
const processing = new Set<string>();
const aborted = new Set<string>();
let isProcessing = false;

for (let i = 0; i < settings.Welcome.token.length; i++) {
    const client = new Client();
    const channelId = settings.Welcome.voice[i] ?? settings.Welcome.voice[0];
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    let connection: VoiceConnection | null = null;

    const isStaff = (m: Discord.GuildMember) => {
        if (m.user.bot) return false;
        if (m.permissions.has(Discord.PermissionFlagsBits.Administrator)) return true;
        return settings.Welcome.staff.some((id) => m.roles.cache.has(id));
    };

    const isUnreg = (m: Discord.GuildMember) => {
        if (m.user.bot) return false;
        return settings.Welcome.unregister.some((id) => m.roles.cache.has(id));
    };

    const playAudio = (filePath: string): Promise<void> => {
        return new Promise((resolve) => {
            if (!fs.existsSync(filePath) || !connection) return resolve();
            player.removeAllListeners(AudioPlayerStatus.Idle);
            player.removeAllListeners('error');
            player.stop(true);
            player.play(createAudioResource(filePath));
            connection.subscribe(player);
            player.once(AudioPlayerStatus.Idle, () => resolve());
            player.once('error', () => resolve());
        });
    };

    const recordVoice = (memberId: string): Promise<string> => {
        return new Promise((resolve) => {
            if (!connection) return resolve('');

            const subscription = connection.receiver.subscribe(memberId, {
                end: { behavior: EndBehaviorType.AfterSilence, duration: 1500 },
            });

            const chunks: Buffer[] = [];
            const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
            subscription.pipe(decoder);
            decoder.on('data', (chunk: Buffer) => chunks.push(chunk));

            const timeout = setTimeout(() => {
                subscription.destroy();
                resolve('');
            }, settings.Register.voiceTimeout);

            decoder.once('end', async () => {
                clearTimeout(timeout);
                if (chunks.length === 0) return resolve('');

                try {
                    const tmpPcm = path.join(os.tmpdir(), `rec_${memberId}_${Date.now()}.pcm`);
                    const tmpWav = tmpPcm.replace('.pcm', '.wav');

                    fs.writeFileSync(tmpPcm, Buffer.concat(chunks));
                    execSync(`ffmpeg -y -f s16le -ar 48000 -ac 2 -i "${tmpPcm}" "${tmpWav}"`, { stdio: 'ignore' });
                    fs.unlinkSync(tmpPcm);

                    const wavData = fs.readFileSync(tmpWav);
                    fs.unlinkSync(tmpWav);

                    const formData = new FormData();
                    formData.append('file', new Blob([wavData], { type: 'audio/wav' }), 'audio.wav');
                    formData.append('model', 'whisper-large-v3');
                    formData.append('language', 'tr');

                    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${settings.Register.groqKey}` },
                        body: formData,
                    });

                    if (!res.ok) return resolve('');
                    const data = (await res.json()) as { text?: string };
                    resolve(data.text?.trim() ?? '');
                } catch {
                    resolve('');
                }
            });
        });
    };

    const containsSwear = (text: string): boolean => {
        const lower = text.toLowerCase().replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ0-9]/g, '');
        return settings.Register.Swear.some((swear) => lower.includes(swear.toLowerCase()));
    };

    const parseNameAge = (text: string): { name: string; age: number } | null => {
        if (!text) return null;

        const ones: Record<string, number> = {
            bir: 1,
            iki: 2,
            üç: 3,
            uc: 3,
            dört: 4,
            dort: 4,
            beş: 5,
            bes: 5,
            altı: 6,
            alti: 6,
            yedi: 7,
            sekiz: 8,
            dokuz: 9,
        };
        const tens: Record<string, number> = {
            on: 10,
            yirmi: 20,
            otuz: 30,
            kırk: 40,
            kirk: 40,
            elli: 50,
            altmış: 60,
            altmis: 60,
            yetmiş: 70,
            yetmis: 70,
            seksen: 80,
            doksan: 90,
        };

        let age: number | null = null;
        const ageMatch = text.match(/\b(1[0-9]|[2-9][0-9])\b/);

        if (ageMatch) {
            age = parseInt(ageMatch[1], 10);
        } else {
            const lower = text.toLowerCase();
            for (const [tw, tv] of Object.entries(tens)) {
                if (lower.includes(tw)) {
                    age = tv;
                    for (const [ow, ov] of Object.entries(ones)) {
                        if (lower.includes(ow)) {
                            age = tv + ov;
                            break;
                        }
                    }
                    break;
                }
            }
        }

        if (!age || age < 10 || age > 99) return null;

        const numberWords = [
            'bir',
            'iki',
            'üç',
            'uc',
            'dört',
            'dort',
            'beş',
            'bes',
            'altı',
            'alti',
            'yedi',
            'sekiz',
            'dokuz',
            'on',
            'yirmi',
            'otuz',
            'kırk',
            'kirk',
            'elli',
            'altmış',
            'altmis',
            'yetmiş',
            'yetmis',
            'seksen',
            'doksan',
        ];

        let cleaned = text
            .replace(/benim\s+ad[ıi]m\s*/gi, '')
            .replace(/ad[ıi]m\s*/gi, '')
            .replace(/ismim\s*/gi, '')
            .replace(/ben\s*/gi, '')
            .replace(/yaş[ıi]ndayım/gi, '')
            .replace(/yaşında/gi, '')
            .replace(/\b\d+\b/g, '');

        for (const w of numberWords) cleaned = cleaned.replace(new RegExp(`\\b${w}\\b`, 'gi'), '');
        cleaned = cleaned.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ\s]/g, '').trim();

        const parts = cleaned.split(/\s+/).filter((w) => w.length > 1);
        if (parts.length === 0) return null;

        return { name: parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase(), age };
    };

    const detectGender = async (name: string): Promise<'man' | 'woman' | 'unknown'> => {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.Register.groqKey}` },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    max_tokens: 10,
                    messages: [
                        {
                            role: 'user',
                            content: `"${name}" ismi Türkçe'de erkek mi kadın mı? Sadece "erkek" veya "kadın" yaz.`,
                        },
                    ],
                }),
            });
            if (!res.ok) return 'unknown';
            const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
            const text = data.choices?.[0]?.message?.content?.toLowerCase() ?? '';
            if (text.includes('erkek')) return 'man';
            if (text.includes('kadın') || text.includes('kadin')) return 'woman';
            return 'unknown';
        } catch {
            return 'unknown';
        }
    };

    const fetchFindcord = async (memberId: string): Promise<FindcordData | null> => {
        if (!settings.Welcome.findcordApi) {
            return null;
        }
        try {
            const res = await fetch(`https://app.findcord.com/api/user/${memberId}`, {
                headers: { Authorization: settings.Welcome.findcordApi },
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) {
                if (res.status !== 404) {
                }
                return null;
            }
            const data = (await res.json()) as any;
            return {
                topName: data.TopName || null,
                topAge: data.TopAge || null,
                topSex:
                    data.TopSex?.toLowerCase() === 'erkek'
                        ? 'erkek'
                        : data.TopSex?.toLowerCase() === 'kadın'
                          ? 'kadın'
                          : null,
                punishments: data.Punishments || [],
                guilds: data.Guilds || [],
            };
        } catch (err) {
            return null;
        }
    };

    const processRegistration = async (member: Discord.GuildMember, voiceChannel: Discord.VoiceChannel) => {
        if (!connection) return;
        const musicDir = path.join(__dirname, '../music');

        try {
            if (connection.state.status !== VoiceConnectionStatus.Ready) {
                await entersState(connection, VoiceConnectionStatus.Ready, 15000).catch(() => {});
            }

            for (const chId of settings.Welcome.voice) {
                if (chId === channelId) continue;
                const ch = member.guild.channels.cache.get(chId) as Discord.VoiceChannel | undefined;
                if (!ch) continue;
                for (const [, m] of ch.members) {
                    if (isStaff(m)) {
                        await playAudio(path.join(musicDir, 'aktariliyor.mp3'));
                        await member.voice.setChannel(ch).catch(() => {});
                        return;
                    }
                }
            }

            await playAudio(path.join(musicDir, 'hosgeldin.mp3'));
            if (aborted.has(member.id)) return;

            const maxAttempts = 3;
            let name: string | null = null;
            let age: number | null = null;
            let method: 'voice' | 'text' = 'voice';
            let rawInput = '';

            const getTextInput = async (): Promise<string> => {
                const textCh = client.channels.cache.get(settings.Register.registerChannel) as
                    | Discord.TextChannel
                    | undefined;
                if (!textCh) return '';

                const prompt = await textCh.send({
                    content: `${member} Lütfen \`Ad Yaş\` formatında yaz. Örnek: \`Ahmet 21\``,
                });

                const result = await new Promise<string>((resolve) => {
                    const timeout = setTimeout(() => {
                        client.removeListener(Discord.Events.MessageCreate, handler);
                        resolve('');
                    }, settings.Register.textTimeout);
                    client.on(Discord.Events.MessageCreate, (msg: Discord.Message) => {
                        if (msg.author.id === member.id && msg.channelId === settings.Register.registerChannel) {
                            clearTimeout(timeout);
                            client.removeListener(Discord.Events.MessageCreate, handler);
                            msg.delete().catch(() => {});
                            resolve(msg.content.trim());
                        }
                    });
                });

                prompt.delete().catch(() => {});
                return result;
            };

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                await member.fetch().catch(() => {});
                if (!member.voice.channelId || aborted.has(member.id)) return;

                if (method === 'voice') {
                    rawInput = await recordVoice(member.id);
                    if (aborted.has(member.id)) return;

                    let parsed = parseNameAge(rawInput);
                    if (!parsed) {
                        method = 'text';
                        await playAudio(path.join(musicDir, 'algilanmadi.mp3'));
                        if (aborted.has(member.id)) return;

                        rawInput = await getTextInput();
                        if (aborted.has(member.id)) return;
                        parsed = parseNameAge(rawInput);
                    }

                    if (parsed) {
                        if (containsSwear(parsed.name) || containsSwear(rawInput)) {
                            await playAudio(path.join(musicDir, 'hata.mp3'));
                            return;
                        }

                        if (
                            parsed.age < settings.Register.minRegisterAge ||
                            parsed.age > settings.Register.maxRegisterAge
                        ) {
                            await playAudio(path.join(musicDir, 'yas.mp3'));
                            continue;
                        }

                        name = parsed.name;
                        age = parsed.age;
                        break;
                    }
                } else {
                    await playAudio(path.join(musicDir, 'algilanmadi.mp3'));
                    if (aborted.has(member.id)) return;

                    rawInput = await getTextInput();
                    if (aborted.has(member.id)) return;

                    const parsed = parseNameAge(rawInput);
                    if (parsed) {
                        if (containsSwear(parsed.name) || containsSwear(rawInput)) {
                            await playAudio(path.join(musicDir, 'hata.mp3'));
                            return;
                        }

                        if (
                            parsed.age < settings.Register.minRegisterAge ||
                            parsed.age > settings.Register.maxRegisterAge
                        ) {
                            await playAudio(path.join(musicDir, 'yas.mp3'));
                            continue;
                        }

                        name = parsed.name;
                        age = parsed.age;
                        break;
                    }
                }

                if (attempt >= maxAttempts - 1) {
                    await playAudio(path.join(musicDir, 'hata.mp3'));
                    return;
                }
            }

            if (!name || !age) {
                await playAudio(path.join(musicDir, 'hata.mp3'));
                return;
            }

            if (aborted.has(member.id)) return;

            let gender: 'man' | 'woman' | 'unknown' = 'unknown';
            let findcordData: FindcordData | null = null;

            if (settings.Welcome.findcordApi) {
                findcordData = await fetchFindcord(member.id);
                if (findcordData) {
                    if (findcordData.punishments.length > 3) {
                        await playAudio(path.join(musicDir, 'hata.mp3'));

                        const logCh = client.channels.cache.get(settings.Register.registerLog) as
                            | Discord.TextChannel
                            | undefined;
                        if (logCh) {
                            const container = new Discord.ContainerBuilder()
                                .addSeparatorComponents(
                                    new Discord.SeparatorBuilder()
                                        .setSpacing(Discord.SeparatorSpacingSize.Large)
                                        .setDivider(true),
                                )
                                .addSectionComponents(
                                    new Discord.SectionBuilder()
                                        .addTextDisplayComponents(
                                            new Discord.TextDisplayBuilder().setContent(
                                                `### Kayıt Reddedildi\n` +
                                                    `-# **Kullanıcı:** ${member} (${member.user.tag})\n` +
                                                    `-# **Söylenen İsim:** ${name} | ${age}\n` +
                                                    `-# **Zaman:** <t:${Math.floor(Date.now() / 1000)}:R>`,
                                            ),
                                        )
                                        .setThumbnailAccessory(
                                            new Discord.ThumbnailBuilder().setURL(
                                                member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                                            ),
                                        ),
                                )
                                .addSeparatorComponents(
                                    new Discord.SeparatorBuilder()
                                        .setSpacing(Discord.SeparatorSpacingSize.Large)
                                        .setDivider(true),
                                )
                                .addTextDisplayComponents(new Discord.TextDisplayBuilder().setContent(`### Red Sebebi`))
                                .addSeparatorComponents(
                                    new Discord.SeparatorBuilder()
                                        .setSpacing(Discord.SeparatorSpacingSize.Small)
                                        .setDivider(true),
                                )
                                .addTextDisplayComponents(
                                    new Discord.TextDisplayBuilder().setContent(
                                        `${findcordData.punishments.length} sicil kaydı bulundu.`,
                                    ),
                                )
                                .addSeparatorComponents(
                                    new Discord.SeparatorBuilder()
                                        .setSpacing(Discord.SeparatorSpacingSize.Large)
                                        .setDivider(true),
                                );

                            await logCh.send({
                                components: [container],
                                flags: Discord.MessageFlags.IsComponentsV2,
                                allowedMentions: { parse: [] },
                            });
                        }
                        return;
                    }

                    if (findcordData.topName && findcordData.topName.toLowerCase() !== name.toLowerCase()) {
                        name =
                            findcordData.topName.charAt(0).toUpperCase() + findcordData.topName.slice(1).toLowerCase();
                    }

                    if (findcordData.topSex === 'erkek') gender = 'man';
                    else if (findcordData.topSex === 'kadın') gender = 'woman';
                    else gender = await detectGender(name);
                } else {
                    gender = await detectGender(name);
                }
            } else {
                gender = await detectGender(name);
            }

            const roles =
                gender === 'man' ? settings.Register.manRoles : gender === 'woman' ? settings.Register.womanRoles : [];

            for (const roleId of settings.Welcome.unregister) {
                await member.roles.remove(roleId).catch(() => {});
            }
            for (const roleId of roles) {
                await member.roles.add(roleId).catch(() => {});
            }
            await member.setNickname(`${name} | ${age}`).catch(() => {});

            await playAudio(path.join(musicDir, 'basarili.mp3'));

            const publicChannels = member.guild.channels.cache.filter(
                (ch) =>
                    ch.type === Discord.ChannelType.GuildVoice &&
                    ch.parentId &&
                    settings.Register.publicParents.includes(ch.parentId),
            );
            const randomCh = publicChannels.random() as Discord.VoiceChannel | undefined;
            if (randomCh) await member.voice.setChannel(randomCh).catch(() => {});

            const logCh = client.channels.cache.get(settings.Register.registerLog) as Discord.TextChannel | undefined;
            if (logCh) {
                const genderText = gender === 'man' ? 'Erkek' : gender === 'woman' ? 'Kadın' : 'Bilinmiyor';
                const methodText = method === 'voice' ? 'Ses' : 'Metin';

                const container = new Discord.ContainerBuilder()
                    .addSeparatorComponents(
                        new Discord.SeparatorBuilder().setSpacing(Discord.SeparatorSpacingSize.Large).setDivider(true),
                    )
                    .addSectionComponents(
                        new Discord.SectionBuilder()
                            .addTextDisplayComponents(
                                new Discord.TextDisplayBuilder().setContent(
                                    `### Yeni Kayıt\n` +
                                        `-# **Kullanıcı:** ${member} (${member.user.tag})\n` +
                                        `-# **İsim:** ${name} | ${age}\n` +
                                        `-# **Cinsiyet:** ${genderText}\n` +
                                        `-# **Yöntem:** ${methodText}\n` +
                                        `-# **Zaman:** <t:${Math.floor(Date.now() / 1000)}:R>`,
                                ),
                            )
                            .setThumbnailAccessory(
                                new Discord.ThumbnailBuilder().setURL(
                                    member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                                ),
                            ),
                    )
                    .addSeparatorComponents(
                        new Discord.SeparatorBuilder().setSpacing(Discord.SeparatorSpacingSize.Large).setDivider(true),
                    );

                if (findcordData) {
                    container
                        .addTextDisplayComponents(new Discord.TextDisplayBuilder().setContent(`### Findcord Bilgileri`))
                        .addSeparatorComponents(
                            new Discord.SeparatorBuilder()
                                .setSpacing(Discord.SeparatorSpacingSize.Small)
                                .setDivider(true),
                        )
                        .addTextDisplayComponents(
                            new Discord.TextDisplayBuilder().setContent(
                                `-# **İsim:** ${findcordData.topName || '-'}\n` +
                                    `-# **Sunucu:** ${findcordData.guilds.length}\n` +
                                    `-# **Sicil:** ${findcordData.punishments.length}`,
                            ),
                        )
                        .addSeparatorComponents(
                            new Discord.SeparatorBuilder()
                                .setSpacing(Discord.SeparatorSpacingSize.Large)
                                .setDivider(true),
                        );
                }

                await logCh.send({
                    components: [container],
                    flags: Discord.MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] },
                });
            }
        } catch (err) {
            await playAudio(path.join(__dirname, '../music/hata.mp3')).catch(() => {});
        }
    };

    const processQueue = async () => {
        if (isProcessing || queue.length === 0) return;
        isProcessing = true;

        while (queue.length > 0) {
            const item = queue.shift()!;
            await item.member.fetch().catch(() => {});
            if (!item.member.voice.channelId) continue;

            processing.add(item.member.id);
            aborted.delete(item.member.id);

            await processRegistration(item.member, item.channel);

            processing.delete(item.member.id);
            aborted.delete(item.member.id);
            await sleep(500);
        }

        isProcessing = false;
    };

    client.once(Discord.Events.ClientReady, async () => {
        const guild = client.guilds.cache.get(settings.Welcome.guildID);
        if (!guild) return;
        await guild.channels.fetch();

        const ch = guild.channels.cache.get(channelId) as Discord.VoiceChannel | undefined;
        if (!ch) return;

        connection = joinVoiceChannel({
            channelId: ch.id,
            guildId: ch.guild.id,
            adapterCreator: ch.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false,
            group: client.user!.id,
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 15000).catch(() => {});

        setInterval(() => {
            const c = client.guilds.cache.get(settings.Welcome.guildID)?.channels.cache.get(channelId) as
                | Discord.VoiceChannel
                | undefined;
            if (!c) return;
            const newConn = joinVoiceChannel({
                channelId: c.id,
                guildId: c.guild.id,
                adapterCreator: c.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false,
                group: client.user!.id,
            });
            if (newConn !== connection) connection = newConn;
        }, 5000);
    });

    client.on(Discord.Events.VoiceStateUpdate, async (oldState, newState) => {
        if (oldState.member?.id === client.user?.id && oldState.channelId && !newState.channelId) {
            const guild = client.guilds.cache.get(settings.Welcome.guildID);
            const ch = guild?.channels.cache.get(channelId) as Discord.VoiceChannel | undefined;
            if (ch) {
                connection = joinVoiceChannel({
                    channelId: ch.id,
                    guildId: ch.guild.id,
                    adapterCreator: ch.guild.voiceAdapterCreator,
                    selfDeaf: false,
                    selfMute: false,
                    group: client.user!.id,
                });
            }
            return;
        }

        const guild = client.guilds.cache.get(settings.Welcome.guildID);
        if (!guild) return;

        const voiceChannel = guild.channels.cache.get(channelId) as Discord.VoiceChannel | undefined;
        if (!voiceChannel) return;

        const member = newState.member ?? oldState.member;
        if (!member || member.user.bot) return;

        const joined = newState.channelId === channelId && oldState.channelId !== channelId;
        const left = oldState.channelId === channelId && newState.channelId !== channelId;

        if (joined) {
            if (isStaff(member)) {
                player.stop(true);
                for (const [, m] of voiceChannel.members) {
                    if (isUnreg(m) && processing.has(m.id)) {
                        aborted.add(m.id);
                    }
                }
                return;
            }

            if (isUnreg(member)) {
                if (!queue.some((q) => q.member.id === member.id) && !processing.has(member.id)) {
                    queue.push({ member, channel: voiceChannel });
                    processQueue();
                }
            }
        }

        if (left && isUnreg(member)) {
            const idx = queue.findIndex((q) => q.member.id === member.id);
            if (idx !== -1) queue.splice(idx, 1);
            if (processing.has(member.id)) {
                aborted.add(member.id);
                player.stop(true);
            }
        }
    });

    void Client.BotLogin(settings.Welcome.token[i], client, `Bot-${i}`);
}
