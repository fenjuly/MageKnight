"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { GameState } from "../lib/game-engine";
import type { Board3DHandle, BoardTarget } from "../lib/three-board";

interface ThreeMapProps {
  state: GameState;
  selection: BoardTarget | null;
  controlsRef: RefObject<Board3DHandle | null>;
  onSelect(target: BoardTarget): void;
  onInspect(cellId: string): void;
  onOpenWiki(cellId: string): void;
  onZoom(zoom: number): void;
  onFailure(message: string): void;
}

/** Load the WebGL engine only on the client, leaving SSR and 2D lightweight. */
export function ThreeMap(props: ThreeMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; props.controlsRef.current?.update(props.state); props.controlsRef.current?.selection(props.selection); }, [props]);
  useEffect(() => {
    let cancelled = false;
    let board: Board3DHandle | undefined;
    void import("../lib/three-board").then(({ createThreeBoard }) => {
      if (cancelled || !host.current) return;
      try {
        board = createThreeBoard(host.current, latest.current.state, {
          select: (target) => latest.current.onSelect(target), inspect: (id) => latest.current.onInspect(id), openWiki: (id) => latest.current.onOpenWiki(id),
          zoom: (value) => latest.current.onZoom(value), fail: (message) => latest.current.onFailure(message),
        });
        latest.current.controlsRef.current = board;
        board.selection(latest.current.selection);
      } catch (error) { latest.current.onFailure(`此设备暂时无法创建 3D 地图，已切回 2D。${error instanceof Error ? `（${error.message}）` : ""}`); }
    }).catch(() => { if (!cancelled) latest.current.onFailure("3D 资源未能加载，已切回 2D 地图。请刷新后重试。"); });
    return () => { cancelled = true; board?.dispose(); latest.current.controlsRef.current = null; };
  }, []);
  return <div className="three-map" ref={host} onPointerDown={(event) => event.stopPropagation()} onPointerMove={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onPointerCancel={(event) => event.stopPropagation()}><span className="three-map-loading">正在布置 3D 微缩地图…</span></div>;
}
