"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Users, Plus, RotateCcw, Crown, Copy, Share2, Loader2, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useGameState } from "@/hooks/useGameState"
import { useGameStats } from "@/hooks/useGameStats"
import { GameEndScreen } from "@/components/GameEndScreen"

const initialTopics = [
  "今天天气",
  "我很开心",
  "学习编程",
  "春天来了",
  "吃饭睡觉",
  "工作学习",
  "朋友聚会",
  "看书写字",
  "运动健身",
  "旅行游玩",
]

const evaluationIcons = {
  egg: "🥚",
  flower: "🌸",
  poop: "💩",
  kiss: "💋",
}

const evaluationLabels = {
  egg: "扔鸡蛋",
  flower: "送鲜花",
  poop: "送狗屎",
  kiss: "送飞吻",
}

const GAME_END_LENGTH = 20 // 游戏结束的字数限制

export default function WordAddingGame() {
  const [playerName, setPlayerName] = useState("")
  const [newWord, setNewWord] = useState("")
  const [customTopic, setCustomTopic] = useState("")
  const [roomId, setRoomId] = useState("")
  const [currentPlayerId, setCurrentPlayerId] = useState("")
  const [selectedPosition, setSelectedPosition] = useState<number>(0)
  const [showJoinRoom, setShowJoinRoom] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [isVoting, setIsVoting] = useState(false) // Added for vote button loading state
  const [pendingWord, setPendingWord] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const { gameState, refetch, forceRefresh } = useGameState(roomId || null)
  const { gameStats, loading: statsLoading } = useGameStats(roomId, gameState.room?.game_ended || false)

  // 从 URL 参数或 localStorage 获取房间号和玩家ID
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const roomFromUrl = urlParams.get("room")
    const storedPlayerId = localStorage.getItem("currentPlayerId")
    const storedRoomId = localStorage.getItem("roomId")

    if (roomFromUrl) {
      setRoomId(roomFromUrl)
      // 如果URL中有房间号，并且localStorage中有匹配的玩家ID，则尝试自动登录
      if (storedPlayerId && storedRoomId === roomFromUrl) {
        setCurrentPlayerId(storedPlayerId)
        // 如果成功自动登录，则不显示加入房间界面
        setShowJoinRoom(false)
      } else {
        // 否则，显示加入房间界面，房间号已预填
        setShowJoinRoom(true)
      }
    } else if (storedRoomId && storedPlayerId) {
      // 如果URL中没有房间号，但localStorage中有，则尝试自动登录
      setRoomId(storedRoomId)
      setCurrentPlayerId(storedPlayerId)
      setShowJoinRoom(false) // 自动登录成功，不显示加入房间界面
    }
  }, [])

  // 将房间号和玩家ID保存到 localStorage
  useEffect(() => {
    if (roomId && currentPlayerId) {
      localStorage.setItem("roomId", roomId)
      localStorage.setItem("currentPlayerId", currentPlayerId)
    }
  }, [roomId, currentPlayerId])

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const createRoom = async () => {
    if (!playerName.trim()) return

    setIsJoining(true)
    try {
      const newRoomId = generateRoomId()
      const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      console.log("Creating room with ID:", newRoomId, "Player ID:", playerId)

      // 创建房间
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .insert({
          id: newRoomId,
          host_id: playerId,
        })
        .select()

      if (roomError) {
        console.error("Room creation error:", roomError)
        throw roomError
      }

      console.log("Room created successfully:", roomData)

      // 添加房主为玩家
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .insert({
          id: playerId,
          room_id: newRoomId,
          name: playerName.trim(),
          is_host: true,
          player_order: 0,
        })
        .select()

      if (playerError) {
        console.error("Player creation error:", playerError)
        throw playerError
      }

      console.log("Player created successfully:", playerData)

      setCurrentPlayerId(playerId)
      setRoomId(newRoomId)

      // 更新 URL
      window.history.pushState({}, "", `?room=${newRoomId}`)
    } catch (error) {
      console.error("创建房间失败:", error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : error && typeof error === "object" && "message" in error
            ? (error as any).message
            : "创建房间失败，请重试"
      alert(errorMessage)
    } finally {
      setIsJoining(false)
    }
  }

  const joinRoom = async () => {
    if (!playerName.trim() || !roomId.trim()) return

    setIsJoining(true)
    try {
      console.log("Joining room:", roomId.trim())

      // 检查房间是否存在
      const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId.trim()).single()

      if (roomError) {
        console.error("Room fetch error:", roomError)
        if (roomError.code === "PGRST116") {
          throw new Error("房间不存在")
        }
        throw roomError
      }

      if (!room) {
        throw new Error("房间不存在")
      }

      console.log("Room found:", room)

      // 检查玩家是否已经在房间中
      const { data: existingPlayers, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomId.trim())

      if (playersError) {
        console.error("Players fetch error:", playersError)
        throw playersError
      }

      const playerOrder = existingPlayers ? existingPlayers.length : 0
      const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      console.log("Adding player with ID:", playerId, "Order:", playerOrder)

      // 添加玩家
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .insert({
          id: playerId,
          room_id: roomId.trim(),
          name: playerName.trim(),
          is_host: false,
          player_order: playerOrder,
        })
        .select()

      if (playerError) {
        console.error("Player join error:", playerError)
        throw playerError
      }

      console.log("Player joined successfully:", playerData)

      setCurrentPlayerId(playerId)
      setRoomId(roomId.trim())

      // 更新 URL
      window.history.pushState({}, "", `?room=${roomId.trim()}`)
    } catch (error) {
      console.error("加入房间失败:", error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : error && typeof error === "object" && "message" in error
            ? (error as any).message
            : "加入房间失败，请重试"
      alert(errorMessage)
    } finally {
      setIsJoining(false)
    }
  }

  const startGame = async () => {
    if (!roomId || !gameState.room) return

    const topic = customTopic.trim() || initialTopics[Math.floor(Math.random() * initialTopics.length)]

    console.log("开始游戏，题面:", topic)

    try {
      const { data, error } = await supabase
        .from("rooms")
        .update({
          current_sentence: topic,
          game_started: true,
          game_ended: false,
          current_player_index: 0,
          round_number: 1,
        })
        .eq("id", roomId)
        .select()

      if (error) {
        console.error("更新房间失败:", error)
        throw error
      }

      console.log("房间更新成功:", data)
      setCustomTopic("")

      // 手动刷新游戏状态
      await forceRefresh()
    } catch (error) {
      console.error("开始游戏失败:", error)
      alert("开始游戏失败，请重试")
    }
  }

  const handleAddWordClick = () => {
    if (!newWord.trim() || newWord.length !== 1) {
      return
    }
    setPendingWord(newWord.trim())
    setShowConfirmation(true)
    setNewWord("") // Clear input field
  }

  const confirmAddWord = async () => {
    if (!pendingWord || !roomId || !gameState.room) return

    const wordToAdd = pendingWord
    setPendingWord(null) // Clear pending word
    setShowConfirmation(false) // Hide confirmation UI

    const currentPlayer = gameState.players[gameState.room.current_player_index]
    if (currentPlayer.id !== currentPlayerId) {
      console.log("不是当前玩家的回合")
      return
    }

    console.log("开始添加字:", {
      word: wordToAdd,
      position: selectedPosition,
      currentSentence: gameState.room.current_sentence,
    })

    try {
      const sentenceBefore = gameState.room.current_sentence
      const newSentence = sentenceBefore.slice(0, selectedPosition) + wordToAdd + sentenceBefore.slice(selectedPosition)

      console.log("新句子:", newSentence, "长度:", newSentence.length)

      // 检查是否达到结束条件
      const gameWillEnd = newSentence.length >= GAME_END_LENGTH

      // 添加游戏动作记录
      const { data: moveData, error: moveError } = await supabase
        .from("game_moves")
        .insert({
          room_id: roomId,
          player_id: currentPlayerId,
          player_name: currentPlayer.name,
          added_word: wordToAdd,
          position: selectedPosition,
          sentence_before: sentenceBefore,
          sentence_after: newSentence,
          round_number: gameState.room.round_number,
        })
        .select()
        .single()

      if (moveError) {
        console.error("添加游戏动作失败:", moveError)
        throw moveError
      }

      console.log("游戏动作已添加:", moveData)

      // 更新房间状态
      const roomUpdate: any = {
        current_sentence: newSentence,
      }

      if (gameWillEnd) {
        // 游戏结束
        roomUpdate.game_ended = true
        roomUpdate.show_evaluation_phase = false
        console.log("游戏结束条件达成！")
      } else {
        // 继续游戏，进入评价阶段
        roomUpdate.show_evaluation_phase = true
      }

      const { error: roomError } = await supabase.from("rooms").update(roomUpdate).eq("id", roomId)

      if (roomError) {
        console.error("更新房间状态失败:", roomError)
        throw roomError
      }

      console.log("房间状态已更新")

      setSelectedPosition(0)

      // 手动刷新游戏状态
      await forceRefresh()

      // 如果游戏没有结束，10秒后自动进入下一轮或处理投票结果
      if (!gameWillEnd) {
        setTimeout(async () => {
          // 重新获取最新的 move 状态，包括 vote_status
          const { data: latestMove, error: moveFetchError } = await supabase
            .from("game_moves")
            .select("id, player_id, sentence_before, vote_status, vote_outcome_message")
            .eq("id", moveData.id)
            .single()

          if (moveFetchError) {
            console.error("获取最新动作失败:", moveFetchError)
            // 即使获取失败，也尝试进入下一轮以避免卡死
            const nextPlayerIndex = (gameState.room!.current_player_index + 1) % gameState.players.length
            await supabase
              .from("rooms")
              .update({
                current_player_index: nextPlayerIndex,
                round_number: gameState.room!.round_number + 1,
                show_evaluation_phase: false,
              })
              .eq("id", roomId)
            await forceRefresh()
            return
          }

          // 如果投票状态仍为 pending，则计算投票结果
          if (latestMove.vote_status === "pending") {
            const { data: votes, error: votesError } = await supabase
              .from("move_votes")
              .select("*")
              .eq("move_id", latestMove.id)

            if (votesError) {
              console.error("获取投票失败:", votesError)
              // 即使获取失败，也尝试进入下一轮
              const nextPlayerIndex = (gameState.room!.current_player_index + 1) % gameState.players.length
              await supabase
                .from("rooms")
                .update({
                  current_player_index: nextPlayerIndex,
                  round_number: gameState.room!.round_number + 1,
                  show_evaluation_phase: false,
                })
                .eq("id", roomId)
              await forceRefresh()
              return
            }

            const totalPlayersExcludingMover = gameState.players.length - 1
            const votesToPass = Math.ceil(totalPlayersExcludingMover / 2) // 简单多数
            const cancelVotes = votes.filter((v) => v.vote_type === "cancel_round").length

            let voteOutcomeMessage = ""
            let newVoteStatus: "passed" | "failed" = "failed"
            const roomUpdate: any = {}
            let playerScoreUpdate: { playerId: string; scoreChange: number } | null = null

            if (cancelVotes >= votesToPass) {
              // 投票通过：回滚句子，扣分
              newVoteStatus = "passed"
              voteOutcomeMessage = `投票通过！${latestMove.player_name} 添加的字被取消，并扣除 5 分。`
              roomUpdate.current_sentence = latestMove.sentence_before // 回滚句子
              playerScoreUpdate = { playerId: latestMove.player_id, scoreChange: -5 }
              console.log("投票通过，句子回滚，玩家扣分。")
            } else {
              // 投票失败：继续当前句子
              newVoteStatus = "failed"
              voteOutcomeMessage = `投票未通过。${latestMove.player_name} 添加的字保留。`
              console.log("投票未通过，句子保留。")
            }

            // 更新 game_moves 的投票状态和结果信息
            const { error: updateMoveError } = await supabase
              .from("game_moves")
              .update({
                vote_status: newVoteStatus,
                vote_outcome_message: voteOutcomeMessage,
              })
              .eq("id", latestMove.id)

            if (updateMoveError) {
              console.error("更新游戏动作投票状态失败:", updateMoveError)
            }

            // 更新房间句子（如果投票通过）
            if (Object.keys(roomUpdate).length > 0) {
              const { error: roomSentenceUpdateError } = await supabase
                .from("rooms")
                .update(roomUpdate)
                .eq("id", roomId)
              if (roomSentenceUpdateError) {
                console.error("更新房间句子失败:", roomSentenceUpdateError)
              }
            }

            // 更新玩家分数（如果投票通过）
            if (playerScoreUpdate) {
              const { data: playerToUpdate, error: fetchPlayerError } = await supabase
                .from("players")
                .select("score")
                .eq("id", playerScoreUpdate.playerId)
                .single()

              if (fetchPlayerError) {
                console.error("获取玩家分数失败:", fetchPlayerError)
              } else {
                const newScore = (playerToUpdate?.score || 0) + playerScoreUpdate.scoreChange
                const { error: updateScoreError } = await supabase
                  .from("players")
                  .update({ score: newScore })
                  .eq("id", playerScoreUpdate.playerId)

                if (updateScoreError) {
                  console.error("更新玩家分数失败:", updateScoreError)
                }
              }
            }
          } else {
            // 如果投票状态已经不是 pending (例如，在10秒内所有人都投了票，提前处理了结果)
            console.log("投票结果已处理，直接进入下一轮。")
          }

          // 进入下一轮
          const nextPlayerIndex = (gameState.room!.current_player_index + 1) % gameState.players.length
          const { error: nextRoundError } = await supabase
            .from("rooms")
            .update({
              current_player_index: nextPlayerIndex,
              round_number: gameState.room!.round_number + 1,
              show_evaluation_phase: false,
            })
            .eq("id", roomId)

          if (nextRoundError) {
            console.error("进入下一轮失败:", nextRoundError)
          } else {
            console.log("已进入下一轮")
            await forceRefresh() // 再次刷新游戏状态
          }
        }, 10000) // 10秒评价时间
      }
    } catch (error) {
      console.error("添加字失败:", error)
      alert("添加字失败，请重试")
    }
  }

  const cancelAddWord = () => {
    setPendingWord(null)
    setShowConfirmation(false)
    setNewWord("") // Clear input field
  }

  const addEvaluation = async (type: "egg" | "flower" | "poop" | "kiss") => {
    if (!gameState.currentMove || !roomId) return
    if (gameState.currentMove.player_id === currentPlayerId) return

    // 检查是否已经评价过
    const hasEvaluated = gameState.evaluations.some((evaluation) => evaluation.evaluator_id === currentPlayerId)
    if (hasEvaluated) return

    const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId)
    if (!currentPlayer) return

    setIsEvaluating(true)
    try {
      console.log("添加评价:", {
        type,
        moveId: gameState.currentMove.id,
        evaluatorId: currentPlayerId,
        evaluatorName: currentPlayer.name,
      })

      const { data, error } = await supabase
        .from("evaluations")
        .insert({
          room_id: roomId,
          move_id: gameState.currentMove.id,
          evaluator_id: currentPlayerId,
          evaluator_name: currentPlayer.name,
          evaluation_type: type,
        })
        .select()

      if (error) {
        console.error("添加评价失败:", error)
        throw error
      }

      console.log("评价已添加:", data)

      // 手动刷新游戏状态
      await forceRefresh()
    } catch (error) {
      console.error("添加评价失败:", error)
      alert("添加评价失败，请重试")
    } finally {
      setIsEvaluating(false)
    }
  }

  const addVote = async (type: "cancel_round") => {
    if (!gameState.currentMove || !roomId) return
    if (gameState.currentMove.player_id === currentPlayerId) return // 不能给自己投票

    // 检查是否已经投过票
    const hasVoted = gameState.currentMoveVotes.some((vote) => vote.voter_id === currentPlayerId)
    if (hasVoted) return

    const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId)
    if (!currentPlayer) return

    setIsVoting(true)
    try {
      console.log("添加投票:", {
        type,
        moveId: gameState.currentMove.id,
        voterId: currentPlayerId,
      })

      const { data, error } = await supabase
        .from("move_votes")
        .insert({
          move_id: gameState.currentMove.id,
          voter_id: currentPlayerId,
          vote_type: type,
        })
        .select()

      if (error) {
        console.error("添加投票失败:", error)
        throw error
      }

      console.log("投票已添加:", data)

      // 检查是否所有人都已投票，如果是，则提前处理投票结果
      const totalPlayersExcludingMover = gameState.players.length - 1
      const currentVotesCount = gameState.currentMoveVotes.length + 1 // 加上当前这一票
      if (currentVotesCount >= totalPlayersExcludingMover) {
        console.log("所有玩家已投票，提前处理投票结果。")
        // 触发一次强制刷新，让 setTimeout 逻辑能够获取到最新的投票数据并处理
        await forceRefresh()
      } else {
        // 否则，只刷新当前状态
        await forceRefresh()
      }
    } catch (error) {
      console.error("添加投票失败:", error)
      alert("添加投票失败，请重试")
    } finally {
      setIsVoting(false)
    }
  }

  const resetGame = async () => {
    if (!roomId) return

    try {
      const { error } = await supabase
        .from("rooms")
        .update({
          current_sentence: "",
          game_started: false,
          game_ended: false,
          current_player_index: 0,
          round_number: 1,
          show_evaluation_phase: false,
        })
        .eq("id", roomId)

      if (error) throw error
      setSelectedPosition(0)

      // 手动刷新游戏状态
      await forceRefresh()
    } catch (error) {
      console.error("重置游戏失败:", error)
      alert("重置游戏失败，请重试")
    }
  }

  const copyRoomLink = async () => {
    const link = `${window.location.origin}?room=${roomId}`

    try {
      await navigator.clipboard.writeText(link)
      alert("房间链接已复制到剪贴板！")
    } catch (error) {
      // 如果剪贴板 API 不可用，创建一个临时输入框
      const textArea = document.createElement("textarea")
      textArea.value = link
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      alert("房间链接已复制到剪贴板！")
    }
  }

  const shareRoom = async () => {
    const link = `${window.location.origin}?room=${roomId}`

    try {
      if (navigator.share) {
        await navigator.share({
          title: "加字游戏",
          text: "来一起玩加字游戏吧！",
          url: link,
        })
      } else {
        copyRoomLink()
      }
    } catch (error) {
      // 如果分享被取消或权限被拒绝，则回退到复制链接
      if (error instanceof Error && error.name !== "AbortError") {
        console.log("分享失败，回退到复制链接")
      }
      copyRoomLink()
    }
  }

  const getCurrentPlayer = () => {
    if (!gameState.room) return null
    return gameState.players[gameState.room.current_player_index]
  }

  const isCurrentPlayer = () => {
    const currentPlayer = getCurrentPlayer()
    return currentPlayer && currentPlayer.id === currentPlayerId
  }

  const isHost = () => {
    const player = gameState.players.find((p) => p.id === currentPlayerId)
    return player && player.is_host
  }

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await forceRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Helper function to calculate received evaluations for a player
  const getPlayerAccumulatedReceivedEvaluations = (playerId: string) => {
    const receivedEvals = { egg: 0, flower: 0, poop: 0, kiss: 0 }
    if (!gameState.allRoomEvaluations || !gameState.allRoomMoves) return receivedEvals

    gameState.allRoomEvaluations.forEach((evalItem) => {
      const evaluatedMove = gameState.allRoomMoves.find((move) => move.id === evalItem.move_id)
      if (evaluatedMove && evaluatedMove.player_id === playerId) {
        receivedEvals[evalItem.evaluation_type]++
      }
    })
    return receivedEvals
  }

  // 如果游戏已结束，显示结果页面
  if (gameState.room?.game_ended && gameStats && !statsLoading) {
    return (
      <GameEndScreen
        roomId={roomId}
        gameStats={gameStats}
        onRestart={resetGame}
        onCopyLink={copyRoomLink}
        onShare={shareRoom}
        currentPlayerId={currentPlayerId}
      />
    )
  }

  // 如果还没有加入房间
  if (!roomId || !currentPlayerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-800">加字游戏</CardTitle>
            <CardDescription>轮流添加汉字，让句子变得更有趣！</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="playerName" className="text-sm font-medium">
                输入你的昵称
              </label>
              <Input
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="请输入昵称"
                disabled={isJoining}
              />
            </div>

            {!showJoinRoom ? (
              <div className="space-y-3">
                <Button onClick={createRoom} className="w-full" disabled={!playerName.trim() || isJoining}>
                  {isJoining ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  创建房间
                </Button>
                <Button
                  onClick={() => setShowJoinRoom(true)}
                  variant="outline"
                  className="w-full"
                  disabled={!playerName.trim() || isJoining}
                >
                  <Users className="w-4 h-4 mr-2" />
                  加入房间
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label htmlFor="roomId" className="text-sm font-medium">
                    房间号
                  </label>
                  <Input
                    id="roomId"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="请输入房间号"
                    disabled={isJoining}
                  />
                </div>
                <Button
                  onClick={joinRoom}
                  className="w-full"
                  disabled={!playerName.trim() || !roomId.trim() || isJoining}
                >
                  {isJoining ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  加入房间
                </Button>
                <Button
                  onClick={() => setShowJoinRoom(false)}
                  variant="outline"
                  className="w-full"
                  disabled={isJoining}
                >
                  返回
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (gameState.loading || (gameState.room?.game_ended && statsLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>{gameState.room?.game_ended ? "正在计算游戏统计..." : "正在加载游戏..."}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (gameState.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-8">
            <p className="text-red-600 mb-4">{gameState.error}</p>
            <Button onClick={refetch}>重新加载</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 游戏标题和房间信息 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">加字游戏</h1>
          <p className="text-gray-600">第 {gameState.room?.round_number || 1} 轮</p>
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline">房间号: {roomId}</Badge>
            {gameState.room?.current_sentence && (
              <Badge variant="outline">
                {gameState.room.current_sentence.length}/{GAME_END_LENGTH} 字
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={copyRoomLink}>
              <Copy className="w-3 h-3 mr-1" />
              复制链接
            </Button>
            <Button size="sm" variant="outline" onClick={shareRoom}>
              <Share2 className="w-3 h-3 mr-1" />
              分享
            </Button>
            <Button size="sm" variant="outline" onClick={handleManualRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </div>
        </div>

        {/* 游戏进度提示 */}
        {gameState.room?.game_started && gameState.room.current_sentence && (
          <Card className="border-orange-300 bg-orange-50">
            <CardContent className="text-center p-4">
              <p className="text-orange-800">
                {gameState.room.current_sentence.length >= GAME_END_LENGTH - 3 ? (
                  <span className="font-bold">
                    🔥 即将结束！还差 {GAME_END_LENGTH - gameState.room.current_sentence.length} 个字
                  </span>
                ) : (
                  <span>
                    目标：达到 {GAME_END_LENGTH} 个字结束游戏 (当前 {gameState.room.current_sentence.length} 字)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 玩家列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              玩家列表 ({gameState.players.length}人)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gameState.players.map((player, index) => {
                const isMe = player.id === currentPlayerId
                const isCurrentTurn = index === gameState.room?.current_player_index
                const receivedEvals = getPlayerAccumulatedReceivedEvaluations(player.id)

                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-2 rounded-md ${
                      isMe ? "bg-blue-100 border border-blue-300" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {player.is_host && <Crown className="w-4 h-4 text-yellow-500" />}
                      <span className={`font-medium ${isCurrentTurn ? "text-blue-700" : "text-gray-800"}`}>
                        {player.name}
                      </span>
                      {isMe && <Badge variant="default">你</Badge>}
                      {isCurrentTurn && gameState.room?.game_started && (
                        <Badge variant="outline" className="bg-blue-500 text-white">
                          当前
                        </Badge>
                      )}
                    </div>
                    {/* Display player score */}
                    <div className="text-sm font-semibold text-purple-700">分数: {player.score}</div>
                    {/* Existing evaluation display */}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {Object.entries(receivedEvals).map(
                        ([type, count]) =>
                          count > 0 && (
                            <span key={type} className="flex items-center gap-1">
                              <span className="text-base">{evaluationIcons[type as keyof typeof evaluationIcons]}</span>
                              <span className="font-semibold">{count}</span>
                            </span>
                          ),
                      )}
                      {Object.values(receivedEvals).every((c) => c === 0) && (
                        <span className="text-gray-400">暂无评价</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* 游戏区域 */}
        <Card>
          <CardHeader>
            <CardTitle>当前句子</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 添加调试信息 */}
            {process.env.NODE_ENV !== "production" && (
              <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
                <p>调试信息:</p>
                <p>游戏已开始: {gameState.room?.game_started ? "是" : "否"}</p>
                <p>游戏已结束: {gameState.room?.game_ended ? "是" : "否"}</p>
                <p>当前句子: "{gameState.room?.current_sentence || "空"}"</p>
                <p>句子长度: {gameState.room?.current_sentence?.length || 0}</p>
                <p>当前玩家索引: {gameState.room?.current_player_index}</p>
                <p>当前玩家ID: {getCurrentPlayer()?.id}</p>
                <p>你的ID: {currentPlayerId}</p>
                <p>是否轮到你: {isCurrentPlayer() ? "是" : "否"}</p>
                <p>评价阶段: {gameState.room?.show_evaluation_phase ? "是" : "否"}</p>
                <p>当前动作ID: {gameState.currentMove?.id}</p>
                <p>评价数量: {gameState.evaluations.length}</p>
                <p>评价者: {gameState.evaluations.map((e) => e.evaluator_name).join(", ")}</p>
              </div>
            )}

            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800 min-h-[3rem] flex items-center justify-center bg-gray-50 rounded-lg p-4 overflow-hidden">
                {gameState.room?.current_sentence ? (
                  <div
                    className={`flex items-center gap-1 flex-wrap ${
                      gameState.room.current_sentence.length > 15
                        ? "text-2xl"
                        : gameState.room.current_sentence.length > 25
                          ? "text-xl"
                          : gameState.room.current_sentence.length > 35
                            ? "text-lg"
                            : "text-3xl"
                    }`}
                  >
                    {gameState.room.game_started && isCurrentPlayer() && !gameState.room.show_evaluation_phase && (
                      <button
                        onClick={() => setSelectedPosition(0)}
                        className={`w-1 h-8 rounded ${
                          selectedPosition === 0 ? "bg-blue-500" : "bg-gray-300 hover:bg-gray-400"
                        } transition-colors cursor-pointer`}
                        title="在开头插入"
                      />
                    )}
                    {gameState.room?.current_sentence.split("").map((char, index) => {
                      const isNewlyAdded =
                        gameState.currentMove &&
                        index === gameState.currentMove.position &&
                        char === gameState.currentMove.added_word &&
                        gameState.room?.show_evaluation_phase // 只在评价阶段高亮

                      return (
                        <div key={index} className="flex items-center">
                          <span className={`mx-1 ${isNewlyAdded ? "bg-red-200/50 rounded px-0.5" : ""}`}>{char}</span>
                          {gameState.room?.game_started &&
                            isCurrentPlayer() &&
                            !gameState.room.show_evaluation_phase && (
                              <button
                                onClick={() => setSelectedPosition(index + 1)}
                                className={`w-1 h-8 rounded ${
                                  selectedPosition === index + 1 ? "bg-blue-500" : "bg-gray-300 hover:bg-gray-400"
                                } transition-colors cursor-pointer`}
                                title={`在"${char}"后插入`}
                              />
                            )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <span className="text-gray-400">
                    {gameState.room?.game_started ? "句子加载中..." : "等待开始游戏..."}
                  </span>
                )}
              </div>
              {gameState.room?.game_started &&
                isCurrentPlayer() &&
                gameState.room.current_sentence &&
                !gameState.room.show_evaluation_phase && (
                  <p className="text-sm text-blue-600 mt-2">
                    点击蓝色竖线选择插入位置，当前选择：
                    {selectedPosition === 0
                      ? "开头"
                      : selectedPosition === gameState.room.current_sentence.length
                        ? "结尾"
                        : `"${gameState.room.current_sentence[selectedPosition - 1]}"后面`}
                  </p>
                )}
            </div>

            {/* 评价阶段 */}
            {gameState.room?.show_evaluation_phase && gameState.currentMove && (
              <Card className="border-2 border-yellow-300 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="text-center text-lg">🎭 评价时间！</CardTitle>
                  <CardDescription className="text-center">
                    <span className="font-medium">{gameState.currentMove.player_name}</span>
                    在位置{" "}
                    {gameState.currentMove.position === 0
                      ? "开头"
                      : gameState.currentMove.position === gameState.currentMove.sentence_after.length - 1
                        ? "结尾"
                        : `第${gameState.currentMove.position}位后`}
                    添加了 "<span className="font-bold text-blue-600">{gameState.currentMove.added_word}</span>"
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {gameState.currentMove.player_id !== currentPlayerId ? (
                    <div className="space-y-3">
                      <p className="text-center text-sm font-medium">给这次操作评价吧：</p>
                      <div className="flex justify-center gap-3">
                        {(["egg", "flower", "poop", "kiss"] as const).map((type) => {
                          const hasEvaluated = gameState.evaluations.some(
                            (evaluation) => evaluation.evaluator_id === currentPlayerId,
                          )
                          return (
                            <Button
                              key={type}
                              variant="outline"
                              size="sm"
                              onClick={() => addEvaluation(type)}
                              disabled={hasEvaluated || isEvaluating}
                              className="flex flex-col items-center gap-1 h-auto py-2"
                            >
                              <span className="text-xl">{evaluationIcons[type]}</span>
                              <span className="text-xs">{evaluationLabels[type]}</span>
                              {isEvaluating && type === "egg" && <Loader2 className="w-3 h-3 animate-spin mt-1" />}
                            </Button>
                          )
                        })}
                      </div>
                      {gameState.evaluations.some((evaluation) => evaluation.evaluator_id === currentPlayerId) && (
                        <p className="text-center text-sm text-green-600">已评价！</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-gray-600">等待其他玩家评价...</p>
                  )}

                  {/* 显示当前评价 - 替换现有的评价显示部分 */}
                  <div className="space-y-2">
                    <p className="text-center text-sm font-medium">实时评价：</p>

                    {/* 简化的评价统计 - 一行显示 */}
                    <div className="flex justify-center items-center gap-4 bg-gray-50 rounded-lg p-2">
                      {(["egg", "flower", "poop", "kiss"] as const).map((type) => {
                        const count = gameState.evaluations.filter(
                          (evaluation) => evaluation.evaluation_type === type,
                        ).length
                        const userEvaluated = gameState.evaluations.some(
                          (evaluation) =>
                            evaluation.evaluation_type === type && evaluation.evaluator_id === currentPlayerId,
                        )

                        return (
                          <div key={type} className="flex items-center gap-1">
                            <span className="text-lg">{evaluationIcons[type]}</span>
                            <span className={`font-medium ${userEvaluated ? "text-blue-600" : "text-gray-700"}`}>
                              {count}
                            </span>
                            {userEvaluated && <span className="text-xs text-blue-600">✓</span>}
                          </div>
                        )
                      })}
                    </div>

                    {/* 简化的参与者信息 */}
                    <p className="text-center text-xs text-gray-600">
                      已评价：{gameState.evaluations.length}/{gameState.players.length - 1} 人
                    </p>

                    {/* 投票功能 */}
                    {gameState.players.length >= 3 &&
                      gameState.currentMove?.player_id !== currentPlayerId &&
                      gameState.currentMove?.vote_status === "pending" && (
                        <div className="space-y-3 mt-4">
                          <Separator />
                          <p className="text-center text-sm font-medium">
                            觉得这轮加字太垃圾？发起投票取消本轮并扣分：
                          </p>
                          <div className="flex justify-center">
                            <Button
                              onClick={() => addVote("cancel_round")}
                              disabled={
                                isVoting || gameState.currentMoveVotes.some((v) => v.voter_id === currentPlayerId)
                              }
                              className="bg-red-500 hover:bg-red-600 text-white"
                            >
                              {isVoting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "发起投票 (扣5分)"}
                            </Button>
                          </div>
                          <p className="text-center text-xs text-gray-600">
                            已投票取消：
                            {gameState.currentMoveVotes.filter((v) => v.vote_type === "cancel_round").length} /{" "}
                            {Math.ceil((gameState.players.length - 1) / 2)} 票 (需要{" "}
                            {Math.ceil((gameState.players.length - 1) / 2)} 票通过)
                          </p>
                          {gameState.currentMoveVotes.some((v) => v.voter_id === currentPlayerId) && (
                            <p className="text-center text-sm text-green-600">你已投票！</p>
                          )}
                        </div>
                      )}

                    {/* 投票结果显示 */}
                    {gameState.currentMove?.vote_status !== "pending" && (
                      <div className="mt-4 p-3 rounded-lg text-center">
                        <p
                          className={`font-bold text-lg ${
                            gameState.currentMove.vote_status === "passed" ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          投票结果：{gameState.currentMove.vote_status === "passed" ? "通过！" : "未通过。"}
                        </p>
                        {gameState.currentMove.vote_outcome_message && (
                          <p className="text-sm text-gray-700">{gameState.currentMove.vote_outcome_message}</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {!gameState.room?.game_started ? (
              <div className="space-y-4">
                {isHost() && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">自定义题面 (可选)</label>
                      <Input
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        placeholder="输入3-4个字的题面，留空则随机生成"
                        maxLength={6}
                      />
                    </div>
                    <Button onClick={startGame} className="w-full">
                      开始游戏
                    </Button>
                  </>
                )}
                {!isHost() && <p className="text-center text-gray-600">等待房主开始游戏...</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  {isCurrentPlayer() && !gameState.room.show_evaluation_phase ? (
                    <p className="text-green-600 font-medium">轮到你了！选择位置并添加一个字</p>
                  ) : (
                    <p className="text-gray-600">
                      等待 <span className="font-medium">{getCurrentPlayer()?.name}</span> 添加字...
                    </p>
                  )}
                </div>

                {isCurrentPlayer() && gameState.room.current_sentence && !gameState.room.show_evaluation_phase && (
                  <div className="space-y-3">
                    <div className="text-center">
                      <p className="text-sm font-medium mb-2">快速选择位置：</p>
                      <div className="flex justify-center gap-2">
                        <Button
                          variant={selectedPosition === 0 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedPosition(0)}
                        >
                          开头
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPosition(Math.max(0, selectedPosition - 1))}
                          disabled={selectedPosition === 0}
                        >
                          前移
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSelectedPosition(Math.min(gameState.room!.current_sentence.length, selectedPosition + 1))
                          }
                          disabled={selectedPosition === gameState.room.current_sentence.length}
                        >
                          后移
                        </Button>
                        <Button
                          variant={selectedPosition === gameState.room.current_sentence.length ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedPosition(gameState.room!.current_sentence.length)}
                        >
                          结尾
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <>
                  {showConfirmation ? (
                    <div className="space-y-3">
                      <p className="text-center text-lg font-medium">
                        你确定要添加 "<span className="font-bold text-blue-600">{pendingWord}</span>" 吗？
                      </p>
                      {pendingWord && gameState.room?.current_sentence && (
                        <div className="text-center text-xl font-semibold text-gray-800 bg-gray-100 p-3 rounded-md">
                          预览: "
                          {gameState.room.current_sentence.slice(0, selectedPosition) +
                            pendingWord +
                            gameState.room.current_sentence.slice(selectedPosition)}
                          "
                        </div>
                      )}
                      <div className="flex gap-2 justify-center">
                        <Button onClick={confirmAddWord} disabled={isEvaluating}>
                          确认添加
                        </Button>
                        <Button onClick={cancelAddWord} variant="outline" disabled={isEvaluating}>
                          重新输入
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={newWord}
                        onChange={(e) => setNewWord(e.target.value)}
                        placeholder="输入一个汉字"
                        maxLength={1}
                        disabled={!isCurrentPlayer()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddWordClick()
                          }
                        }}
                        className="text-center text-xl"
                      />
                      <Button
                        onClick={handleAddWordClick}
                        disabled={!isCurrentPlayer() || !newWord.trim() || newWord.length !== 1}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>

                {isHost() && (
                  <>
                    <Separator />
                    <Button onClick={resetGame} variant="outline" className="w-full">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      重新开始
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 游戏规则 */}
        <Card>
          <CardHeader>
            <CardTitle>游戏规则</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• 房主创建房间，其他玩家通过房间号加入</li>
              <li>• 游戏开始时会有一个3-4字的题面</li>
              <li>• 玩家轮流添加一个汉字</li>
              <li>• 可以选择在句子的任意位置插入字</li>
              <li>• 每次添加字后，其他玩家可以评价</li>
              <li>
                • <strong>句子达到 {GAME_END_LENGTH} 个字时游戏结束</strong>
              </li>
              <li>• 添加的字要让句子保持合理和有意义</li>
              <li>• 分享房间链接邀请朋友一起玩！</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
