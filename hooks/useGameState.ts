"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase, type Room, type Player, type GameMove, type Evaluation, type MoveVote } from "@/lib/supabase"

interface GameState {
  room: Room | null
  players: Player[]
  currentMove: GameMove | null
  evaluations: Evaluation[] // This is for the current move's evaluations
  allRoomEvaluations: Evaluation[] // New: all evaluations for the room
  allRoomMoves: GameMove[] // New: all game moves for the room
  currentMoveVotes: MoveVote[] // Added
  loading: boolean
  error: string | null
}

export function useGameState(roomId: string | null) {
  const [gameState, setGameState] = useState<GameState>({
    room: null,
    players: [],
    currentMove: null,
    evaluations: [],
    allRoomEvaluations: [],
    allRoomMoves: [],
    currentMoveVotes: [], // Initialize
    loading: false,
    error: null,
  })

  // 使用 ref 来跟踪最后一次更新时间，避免频繁刷新
  const lastUpdateRef = useRef<number>(0)
  // 使用 ref 来跟踪是否已经设置了轮询
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  // 使用 ref 来跟踪当前的 moveId，用于检测是否需要重新获取评价
  const currentMoveIdRef = useRef<number | null>(null)

  const fetchGameState = useCallback(
    async (force = false) => {
      if (!roomId) return

      // 如果不是强制刷新，且距离上次更新不到1秒，则跳过
      const now = Date.now()
      if (!force && now - lastUpdateRef.current < 1000) {
        return
      }

      lastUpdateRef.current = now

      try {
        console.log("正在获取游戏状态...", new Date().toLocaleTimeString())

        // 获取房间信息
        const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single()

        if (roomError) throw roomError

        // 获取玩家列表
        const { data: players, error: playersError } = await supabase
          .from("players")
          .select("*")
          .eq("room_id", roomId)
          .order("player_order")

        if (playersError) throw playersError

        // 获取所有游戏动作
        const { data: allMovesData, error: allMovesError } = await supabase
          .from("game_moves")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at") // Order to get history
        if (allMovesError) throw allMovesError
        const allRoomMoves = allMovesData || []
        console.log("所有游戏动作数量:", allRoomMoves.length)

        // 获取最新的游戏动作 (即 currentMove)
        const currentMove = allRoomMoves.length > 0 ? allRoomMoves[allRoomMoves.length - 1] : null

        // 获取所有评价
        const { data: allEvalData, error: allEvalError } = await supabase
          .from("evaluations")
          .select("*")
          .eq("room_id", roomId) // Filter by room_id
        if (allEvalError) throw allEvalError
        const allRoomEvaluations = allEvalData || []
        console.log("所有房间评价数量:", allRoomEvaluations.length)

        // 获取当前动作的评价
        let evaluations: Evaluation[] = []
        let currentMoveVotes: MoveVote[] = [] // Initialize
        if (currentMove) {
          // 检查是否是新的 moveId
          const moveId = currentMove.id
          const isNewMove = currentMoveIdRef.current !== moveId
          currentMoveIdRef.current = moveId

          // Filter current move's evaluations from all evaluations
          evaluations = allRoomEvaluations.filter((e) => e.move_id === moveId)

          // Fetch votes for the current move
          const { data: votesData, error: votesError } = await supabase
            .from("move_votes")
            .select("*")
            .eq("move_id", moveId)
          if (votesError) throw votesError
          currentMoveVotes = votesData || []
          console.log("当前动作投票数量:", currentMoveVotes.length)

          if (isNewMove) {
            console.log("检测到新的游戏动作，ID:", moveId)
          }
        }

        console.log("游戏状态已更新:", {
          room,
          playersCount: players?.length || 0,
          hasMove: !!currentMove,
          evaluationsCount: evaluations.length, // Current move evaluations
          allRoomEvaluationsCount: allRoomEvaluations.length, // All room evaluations
          allRoomMovesCount: allRoomMoves.length, // All room moves
          moveId: currentMove?.id,
        })

        setGameState({
          room,
          players: players || [],
          currentMove: currentMove,
          evaluations,
          allRoomEvaluations,
          allRoomMoves,
          currentMoveVotes, // Add this line
          loading: false,
          error: null,
        })
      } catch (error) {
        console.error("获取游戏状态失败:", error)
        setGameState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "获取游戏状态失败",
        }))
      }
    },
    [roomId],
  )

  // 设置轮询作为备用方案
  useEffect(() => {
    if (!roomId || pollingRef.current) return

    console.log("设置轮询备用方案")

    // 每5秒轮询一次作为备用
    pollingRef.current = setInterval(() => {
      fetchGameState(true)
    }, 5000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [roomId, fetchGameState])

  // 初始加载和实时订阅
  useEffect(() => {
    if (!roomId) return

    console.log("初始化游戏状态和实时订阅")
    setGameState((prev) => ({ ...prev, loading: true }))

    // 立即获取初始状态
    fetchGameState(true)

    // 创建一个唯一的频道名称
    const channelName = `room-${roomId}-${Date.now()}`

    // 测试 Supabase 连接
    supabase
      .from("rooms")
      .select("id")
      .limit(1)
      .then(
        () => console.log("Supabase 连接正常"),
        (err) => console.error("Supabase 连接错误:", err),
      )

    // 订阅房间变化
    const channel = supabase.channel(channelName)

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          console.log("房间数据变化:", payload)
          fetchGameState(true)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log("玩家数据变化:", payload)
          fetchGameState(true)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_moves",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log("游戏动作变化:", payload)
          fetchGameState(true)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "evaluations",
        },
        (payload) => {
          console.log("评价数据变化:", payload)
          fetchGameState(true)
        },
      )
      .on(
        // Add this new subscription block
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "move_votes",
          filter: `room_id=eq.${roomId}`, // Filter by room_id if move_votes had room_id, otherwise remove filter
        },
        (payload) => {
          console.log("投票数据变化:", payload)
          fetchGameState(true)
        },
      )

    // 订阅并处理状态
    channel.subscribe((status) => {
      console.log(`Supabase 实时订阅状态: ${status}`, new Date().toLocaleTimeString())
    })

    return () => {
      console.log("清理订阅")
      supabase.removeChannel(channel)
    }
  }, [roomId, fetchGameState])

  // 提供手动刷新方法
  const manualRefresh = useCallback(() => {
    console.log("手动刷新游戏状态")
    return fetchGameState(true)
  }, [fetchGameState])

  return {
    gameState,
    refetch: manualRefresh,
    forceRefresh: () => fetchGameState(true),
  }
}
