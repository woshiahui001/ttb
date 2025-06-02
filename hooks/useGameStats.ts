"use client"

import { useState, useEffect } from "react"
import { supabase, type GameStats, type PlayerStats } from "@/lib/supabase"

export function useGameStats(roomId: string | null, gameEnded: boolean) {
  const [gameStats, setGameStats] = useState<GameStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId || !gameEnded) {
      setGameStats(null)
      return
    }

    const fetchGameStats = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log("正在获取游戏统计...")

        // 获取房间信息
        const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single()

        if (roomError) throw roomError

        // 获取所有游戏动作
        const { data: moves, error: movesError } = await supabase
          .from("game_moves")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at")

        if (movesError) throw movesError

        // 获取所有评价
        const { data: evaluations, error: evaluationsError } = await supabase
          .from("evaluations")
          .select("*")
          .eq("room_id", roomId)

        if (evaluationsError) throw evaluationsError

        // 获取玩家信息
        const { data: players, error: playersError } = await supabase
          .from("players")
          .select("*")
          .eq("room_id", roomId)
          .order("player_order")

        if (playersError) throw playersError

        console.log("数据获取成功:", {
          moves: moves?.length,
          evaluations: evaluations?.length,
          players: players?.length,
        })

        // 计算每个玩家的统计
        const playerStats: PlayerStats[] = (players || []).map((player) => {
          const playerMoves = (moves || []).filter((move) => move.player_id === player.id)

          // 计算该玩家收到的评价
          const playerEvaluations = (evaluations || []).filter((evaluation) => {
            const move = moves?.find((m) => m.id === evaluation.move_id)
            return move?.player_id === player.id
          })

          const evaluationsReceived = {
            egg: playerEvaluations.filter((e) => e.evaluation_type === "egg").length,
            flower: playerEvaluations.filter((e) => e.evaluation_type === "flower").length,
            poop: playerEvaluations.filter((e) => e.evaluation_type === "poop").length,
            kiss: playerEvaluations.filter((e) => e.evaluation_type === "kiss").length,
          }

          // 计算正面评价分数 (flower: +2, kiss: +1, egg: 0, poop: -1)
          const totalPositiveScore =
            evaluationsReceived.flower * 2 +
            evaluationsReceived.kiss * 1 +
            evaluationsReceived.egg * 0 +
            evaluationsReceived.poop * -1

          return {
            playerId: player.id,
            playerName: player.name,
            wordsAdded: playerMoves.length,
            evaluationsReceived,
            totalPositiveScore,
            moves: playerMoves,
          }
        })

        // 找出 MVP (评价分数最高的玩家)
        const mvpPlayer = playerStats.reduce((prev, current) => {
          if (current.totalPositiveScore > prev.totalPositiveScore) return current
          if (current.totalPositiveScore === prev.totalPositiveScore && current.wordsAdded > prev.wordsAdded)
            return current
          return prev
        }, playerStats[0])

        const stats: GameStats = {
          finalSentence: room.current_sentence,
          totalMoves: moves?.length || 0,
          playerStats,
          mvpPlayer: mvpPlayer || null,
          allEvaluations: evaluations || [],
          gameHistory: moves || [],
        }

        console.log("游戏统计计算完成:", stats)
        setGameStats(stats)
      } catch (error) {
        console.error("获取游戏统计失败:", error)
        setError(error instanceof Error ? error.message : "获取游戏统计失败")
      } finally {
        setLoading(false)
      }
    }

    fetchGameStats()
  }, [roomId, gameEnded])

  return { gameStats, loading, error }
}
