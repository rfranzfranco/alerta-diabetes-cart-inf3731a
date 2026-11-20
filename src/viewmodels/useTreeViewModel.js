/**
 * VIEWMODEL: useTreeViewModel.js
 * Coordinacion del arbol de decision, disposicion geometrica del grafo SVG
 * y trazado en tiempo real de la ruta activa del paciente.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiService } from '../models/apiService';

export function useTreeViewModel(visitedNodes = []) {
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Carga inicial de la jerarquia del arbol
  useEffect(() => {
    let mounted = true;
    apiService.getTreeTopology()
      .then(data => {
        if (mounted) {
          setTreeData(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Calculo de posiciones y conexiones del grafo vectorial (SVG 1200 x 560)
  const layout = useMemo(() => {
    if (!treeData) return { nodes: [], edges: [] };

    const depthY = [55, 180, 320, 470];
    const nodeWidth = 132;
    const nodeHeight = 58;
    const nodes = [];
    const edges = [];
    const nodeMap = {};

    function recurse(node, leftBound, rightBound, depth) {
      const x = (leftBound + rightBound) / 2;
      const y = depthY[depth] || 470;

      const nodeObj = {
        ...node,
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
        isActive: visitedNodes.includes(node.node_id)
      };

      nodes.push(nodeObj);
      nodeMap[node.node_id] = nodeObj;

      if (!node.is_leaf) {
        const mid = (leftBound + rightBound) / 2;
        recurse(node.left_child, leftBound, mid, depth + 1);
        recurse(node.right_child, mid, rightBound, depth + 1);
      }
    }

    recurse(treeData, 20, 1180, 0);

    // Generar aristas con curvas de bezier suaves
    function buildEdges(node) {
      if (!node.is_leaf) {
        const from = nodeMap[node.node_id];
        const leftTo = nodeMap[node.left_child.node_id];
        const rightTo = nodeMap[node.right_child.node_id];

        [
          { to: leftTo, op: '<=' },
          { to: rightTo, op: '>' }
        ].forEach(({ to, op }) => {
          const startX = from.x;
          const startY = from.y + nodeHeight / 2;
          const endX = to.x;
          const endY = to.y - nodeHeight / 2;
          const midY = (startY + endY) / 2;
          const d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;

          // Una arista esta activa si ambos extremos pertenecen a los nodos visitados
          const isActive = visitedNodes.includes(from.node_id) && visitedNodes.includes(to.node_id);

          edges.push({
            id: `edge-${from.node_id}-${to.node_id}`,
            fromId: from.node_id,
            toId: to.node_id,
            d,
            label: op,
            isActive
          });
        });

        buildEdges(node.left_child);
        buildEdges(node.right_child);
      }
    }

    buildEdges(treeData);

    return { nodes, edges };
  }, [treeData, visitedNodes]);

  const selectedNode = useMemo(
    () => layout.nodes.find(n => n.node_id === selectedNodeId) || null,
    [layout.nodes, selectedNodeId]
  );

  const selectNode = useCallback((node) => {
    setSelectedNodeId(node ? node.node_id : null);
  }, []);

  return {
    treeData,
    loading,
    error,
    nodes: layout.nodes,
    edges: layout.edges,
    selectedNode,
    selectNode
  };
}
