// AUTH URL https://discord.com/api/oauth2/authorize?client_id=961569787924856883&permissions=51264&scope=bot

import * as fs from 'fs/promises'
import { config as dotenvConfig } from 'dotenv'
import fetch, { Response } from 'node-fetch'
import {
  Client,
  Intents,
  MessageEmbed,
  TextChannel,
  ThreadChannel,
  User,
  ThreadAutoArchiveDuration,
} from 'discord.js'
import * as scheduler from 'node-schedule'

dotenvConfig()

type UserProfile = {
  friends: FriendStatus[]
}

type UserProfileWithCurrentMatch = UserProfile & {
  current_match: {
    id: number
  }
}

type FriendStatus = {
  id: number
  username: string
  online_status: number
}

export interface EsportalMatch {
  id: number
  region_id: number
  country_id: number
  map_id: number
  type: number
  flags: number
  active: boolean
  inserted: number
  gotv_host?: null
  gotv_port?: null
  team1_score: number
  team2_score: number
  sponsor_id?: null
  sponsor_link?: null
  demo_available: boolean
  duration: number
  mvp_user_id: number
  rematching: boolean
  rematch_time?: null
  rematch_yes_votes?: null
  rematch_no_votes?: null
  rematch_voted?: null
  server?: null
  players: MatchPlayer[]
  ratings?: null
  team1_avg_elo?: null
  team2_avg_elo?: null
  missions_completed?: null
  levels_achieved?: null
  item_drop?: null
  banned_maps: string
  ban_maps_team?: null
  last_ban_time?: null
  map_pool?: null
  team1_win_chance: number
  team2_win_chance: number
  is_eligible_for_finnkampen: boolean
}

export interface MatchPlayer {
  id: number
  username: string
  avatar_hash: string
  country_id: number
  display_medals: number
  flags: number
  region_id: number
  subregion_id: number
  roles?: null[] | null
  wins: number
  losses: number
  elo: number
  recent_kills: number
  recent_deaths: number
  recent_kdr_matches: number
  recent_headshots: number
  recent_wins: number
  recent_losses: number
  recent_matches: number
  recent_drops: number
  match_flags: number
  twitch_username?: null
  twitch_viewers?: null
  favorite_map_id: number
  favorite_weapon_id: number
  kills: number
  deaths: number
  assists: number
  headshots: number
  successful_opening_rounds: number
  opening_kills: number
  opening_deaths: number
  clutches: number
  score: number
  match_favorite_weapon_id: number
  total_kills: number
  total_deaths: number
  current_winning_streak: number
  bomb_plants: number
  bomb_defuses: number
  banned: boolean
  elo_change?: number | null
  team: number
  dropped: number
  dropin: number
  matchmaking_group_id: number
}

const getPlayerStatuses = async () => {
  const response = (await fetch(
    `https://esportal.com/api/user_profile/get?_=${Date.now()}&username=HalloumiKing&friends=1`
  ).then((res) => res.json())) as UserProfile
  return response.friends
}

const getMatch = async (id: number) =>
  (await fetch(
    `https://esportal.com/api/match/get?_=${Date.now()}&id=${id}`
  ).then((res) => res.json())) as EsportalMatch

const getCurrentMatchForUser = async (id: number) => {
  const player = (await fetch(
    `https://esportal.com/api/user_profile/get?_=${Date.now()}&id=${id}&current_match=1`
  ).then((res) => res.json())) as UserProfileWithCurrentMatch
  return getMatch(player.current_match.id)
}

enum ONLINE_STATUS {
  OFFLINE = 0,
  ONLINE = 5,
  IN_GAME = 1,
  AFK = 2,
}

type Bet = {
  better: User
  amount: number
  team: 'team1' | 'team2'
}

type Match = {
  data: EsportalMatch
  date: number
  finished: boolean
  thread: ThreadChannel | null
  bets: Record<string, Bet>
}

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
})

const loadSaldos = async (): Promise<Record<string, number>> => {
  try {
    const data = await fs.readFile('./saldos.json')
    return JSON.parse(data.toString('utf-8'))
  } catch (err) {
    return {}
  }
}

const onceADay = new scheduler.RecurrenceRule()
onceADay.hour = 6
onceADay.minute = 0
onceADay.second = 0
onceADay.tz = 'Europe/Helsinki'

const saveSaldos = (saldos: Record<string, number>) =>
  fs.writeFile('./saldos.json', JSON.stringify(saldos))

client.login(process.env.DISCORD_TOKEN)

client.on('ready', async () => {
  console.log('Ready!')
  const channel: TextChannel = (await client.channels.fetch(
    process.env.CHANNEL_ID!
  )) as TextChannel

  let matches: Match[] = []
  const saldos: Record<string, number> = await loadSaldos()

  scheduler.scheduleJob(onceADay, async () => {
    for (let userId of Object.keys(saldos)) {
      saldos[userId] += 100
    }

    await channel.send(`💰 Kaikkien saldoon on lisätty 100 shillinkiä! 💰`)
  })

  client.on('messageCreate', async (message) => {
    const better = message.author

    // Init saldos when encountering a new messager
    if (typeof saldos[better.id] === 'undefined') {
      saldos[better.id] = 1000
    }

    if (message.content === '!saldo') {
      await message.channel.send(
        `💰 Saldosi on ${saldos[better.id]} shillinkiä ${better.toString()} 💰`
      )
      return
    }

    if (message.content === '!top') {
      const sortedSaldos = Object.entries(saldos).sort(([, a], [, b]) => b - a)

      const [first, second, third] = await Promise.all([
        channel.guild.members.fetch(sortedSaldos[0][0]),
        channel.guild.members.fetch(sortedSaldos[1][0]),
        channel.guild.members.fetch(sortedSaldos[2][0]),
      ])

      await message.channel.send(
        `Top3 shillingit:
🥇 ${first.nickname ?? first.user.username}: ${sortedSaldos[0][1]} shillinkiä
🥈 ${second.nickname ?? second.user.username}: ${sortedSaldos[1][1]} shillinkiä
🥉 ${third.nickname ?? third.user.username}: ${sortedSaldos[2][1]} shillinkiä
        `
      )
      return
    }

    if (message.content === '!bottom') {
      const sortedSaldos = Object.entries(saldos).sort(([, a], [, b]) => a - b)

      const [first, second, third] = await Promise.all([
        channel.guild.members.fetch(sortedSaldos[0][0]),
        channel.guild.members.fetch(sortedSaldos[1][0]),
        channel.guild.members.fetch(sortedSaldos[2][0]),
      ])

      await message.channel.send(
        `Bottom3 shillingit:
🥇 ${first.nickname ?? first.user.username}: ${sortedSaldos[0][1]} shillinkiä
🥈 ${second.nickname ?? second.user.username}: ${sortedSaldos[1][1]} shillinkiä
🥉 ${third.nickname ?? third.user.username}: ${sortedSaldos[2][1]} shillinkiä
        `
      )
      return
    }

    for (let match of matches) {
      if (match.thread === null) {
        continue
      }
      if (match.finished) {
        continue
      }

      if (message.channelId !== match.thread.id) {
        continue
      }

      const [msgMatch, team, amountStr] =
        message.content.match(/^!bet (team1|team2) (\d+)$/) ?? []

      if (!msgMatch) {
        return
      }

      const amount = parseInt(amountStr)

      if (match.date + 1000 * 60 * 5 < Date.now()) {
        await message.react('❌')
        await message.channel.send(
          `⌛ Olit liian myöhässä ${better.toString()} ⌛`
        )
        return
      }

      if (amount > saldos[better.id]) {
        await message.react('❌')
        await message.channel.send(
          `💸 Ei tarpeeks saldoa, vitun köyhä ${better.toString()} 💸`
        )
        return
      }

      // Refund existing bet amount if replaced
      const existingBet = match.bets[better.id]
      if (existingBet) {
        saldos[better.id] += existingBet.amount
      }

      saldos[better.id] -= amount
      match.bets[better.id] = {
        better,
        amount,
        team: team as 'team1' | 'team2',
      }

      await message.react('✅')
    }
  })

  const playerStatuses: Record<string, number> = {}

  const updateLoop = async () => {
    try {
      for (const player of await getPlayerStatuses()) {
        if (
          playerStatuses[player.id] !== ONLINE_STATUS.IN_GAME &&
          player.online_status === ONLINE_STATUS.IN_GAME
        ) {
          const match = await getCurrentMatchForUser(player.id)

          const matchExists = matches.some((m) => m.data.id === match.id)

          // New match!
          if (!matchExists) {
            matches.push({
              data: match,
              date: Date.now(),
              finished: false,
              thread: null,
              bets: {},
            })
          }
        }

        playerStatuses[player.id] = player.online_status
      }

      for (const match of matches) {
        if (!match.data.active) {
          continue
        }
        const matchData = await getMatch(match.data.id)

        // Betting thread not yet created, and a map has been selected.
        // Create the thread and start listening for bets.
        if (!match.thread && matchData.map_id) {
          const team1Players = matchData.players.filter(
            (player) => player.team === 1
          )
          const team2Players = matchData.players.filter(
            (player) => player.team === 2
          )

          const team1Odds = (2 - matchData.team1_win_chance).toFixed(2)
          const team2Odds = (2 - matchData.team2_win_chance).toFixed(2)

          const matchEmbed = new MessageEmbed()
            .setColor('#5700a2')
            .setTitle(`🎮 Uusi matsi! #${matchData.id} 🎮`)
            .setURL(`https://esportal.com/fi/match/${matchData.id}`)
            .setDescription(
              'Lisätkää veikkauksenne threadiin! Aikaa veikkauksien lisäämiseen on viisi minuuttia tämän viestin lähetyksestä.'
            )
            .addFields(
              {
                name: 'Team1',
                value: team1Players
                  .map((player) => ` • ${player.username}`)
                  .join('\n'),
                inline: true,
              },
              {
                name: 'Team2',
                value: team2Players
                  .map((player) => ` • ${player.username}`)
                  .join('\n'),
                inline: true,
              },
              {
                name: 'Kertoimet',
                value: `Team1: ${team1Odds}x • Team2: ${team2Odds}x`,
              }
            )

          const message = await channel.send({
            content: '🎮 @here 🎮',
            embeds: [matchEmbed],
          })

          match.thread = await message.startThread({
            autoArchiveDuration: 60,
            name: `Matsi #${matchData.id}`,
          })

          setTimeout(() => {
            match.thread?.send('⌛ Enää minuutti aikaa! ⌛')
          }, 1000 * 60 * 4)

          setTimeout(() => {
            match.thread?.send(`🔒 Panokset lukittu. 🔒`)
          }, 1000 * 60 * 5)
        }

        if (!matchData.active && !match.finished) {
          if (matchData.team1_score === matchData.team2_score) {
            match.thread?.send(
              '❌ Matsi peruttu tjsp. En jaksa välittää. Mitään ei tapahdu. ❌'
            )

            for (const bet of Object.values(match.bets)) {
              saldos[bet.better.id] += bet.amount
            }

            continue
          }

          const winner =
            matchData.team1_score > matchData.team2_score ? 'team1' : 'team2'
          const payouts: { amount: number; better: User }[] = []

          for (const bet of Object.values(match.bets)) {
            if (bet.team === winner) {
              const key = `${winner}_win_chance` as
                | 'team1_win_chance'
                | 'team2_win_chance'
              const factor = matchData[key]
              const payout = Math.round(bet.amount * (2 - factor))

              saldos[bet.better.id] += payout

              payouts.push({ amount: payout, better: bet.better })
            }
          }

          match.thread?.send(`
            💰 Matsi päättyi. Shillinkejä päätyi voittajille seuraavasti: 💰
${payouts
  .map(
    (payout) => ` • ${payout.better.toString()} +${payout.amount} shillinkiä`
  )
  .join('\n')}
          `)

          console.log('saldos', saldos)
          console.log(
            'payouts',
            payouts.map((p) => ({
              id: p.better.id,
              amount: p.amount,
            }))
          )
          await saveSaldos(saldos)

          setTimeout(() => {
            match.thread?.setArchived(true)
          }, 1000 * 60 * 5)

          setTimeout(() => {
            match.thread?.setArchived(true)
          }, 1000 * 60 * 10)

          match.finished = true
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  updateLoop()
  setInterval(updateLoop, 1000 * 30)
})
