import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

interface PriorityArea {
  name: string;
  score: number;
  explanation: string;
}

interface Position {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  angle: number;
  score: number;
  textAnchor: 'start' | 'middle' | 'end';
}

interface SummaryGraphProps {
  priorityAreas: PriorityArea[];
}

export default function SummaryGraph({ priorityAreas }: SummaryGraphProps) {
  console.log('SummaryGraph rendered with priorityAreas:', priorityAreas);
  
  // Constants for the graph
  const centerX = 400;
  const centerY = 400;
  const radius = 200;
  const numAreas = priorityAreas.length;
  
  console.log('Graph dimensions:', { centerX, centerY, radius, numAreas });

  // Calculate positions for each priority area
  const positions = priorityAreas.map((area, index): Position => {
    const angle = (index * 2 * Math.PI) / numAreas;
    const scoreRadius = (radius * area.score) / 10;
    const x = centerX + scoreRadius * Math.sin(angle);
    const y = centerY - scoreRadius * Math.cos(angle);
    
    // Calculate label position with more padding
    const labelRadius = radius + 80;
    const labelX = centerX + labelRadius * Math.sin(angle);
    const labelY = centerY - labelRadius * Math.cos(angle);
    
    // Calculate text anchor based on angle to prevent cutoff
    let textAnchor: 'start' | 'middle' | 'end' = 'middle';
    if (angle > Math.PI * 0.25 && angle < Math.PI * 0.75) {
      textAnchor = 'start'; // Right side
    } else if (angle > Math.PI * 0.75 && angle < Math.PI * 1.25) {
      textAnchor = 'end'; // Bottom
    } else if (angle > Math.PI * 1.25 && angle < Math.PI * 1.75) {
      textAnchor = 'end'; // Left side
    } else {
      textAnchor = 'middle'; // Top
    }

    // Adjust label position based on text anchor
    let adjustedLabelX = labelX;
    if (textAnchor === 'start') {
      adjustedLabelX = labelX - 20;
    } else if (textAnchor === 'end') {
      adjustedLabelX = labelX + 20;
    }

    console.log(`Area ${area.name} position:`, { 
      x, y, 
      labelX: adjustedLabelX, 
      labelY, 
      score: area.score, 
      textAnchor,
      angle: angle * (180/Math.PI) // Convert to degrees for easier debugging
    });
    
    return {
      x,
      y,
      labelX: adjustedLabelX,
      labelY,
      angle,
      score: area.score,
      textAnchor
    };
  });

  console.log('All positions calculated:', positions);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Priority Areas</Text>
      <View style={styles.graphContainer}>
        <Svg width={1200} height={1200} style={styles.svg}>
          {/* Draw axes */}
          {positions.map((pos, index) => {
            console.log(`Drawing axis for ${priorityAreas[index].name}`);
            return (
              <Line
                key={`axis-${index}`}
                x1={centerX}
                y1={centerY}
                x2={centerX + radius * Math.sin(pos.angle)}
                y2={centerY - radius * Math.cos(pos.angle)}
                stroke="#ccc"
                strokeWidth={1}
              />
            );
          })}

          {/* Draw score points */}
          {positions.map((pos, index) => {
            console.log(`Drawing score point for ${priorityAreas[index].name}`);
            return (
              <Circle
                key={`point-${index}`}
                cx={pos.x}
                cy={pos.y}
                r={5}
                fill="#007AFF"
              />
            );
          })}

          {/* Draw connecting lines */}
          {positions.map((pos, index) => {
            const nextPos = positions[(index + 1) % positions.length];
            console.log(`Drawing connecting line from ${priorityAreas[index].name} to ${priorityAreas[(index + 1) % positions.length].name}`);
            return (
              <Line
                key={`line-${index}`}
                x1={pos.x}
                y1={pos.y}
                x2={nextPos.x}
                y2={nextPos.y}
                stroke="#007AFF"
                strokeWidth={2}
              />
            );
          })}

          {/* Draw labels */}
          {positions.map((pos, index) => {
            console.log(`Drawing label for ${priorityAreas[index].name}`);
            return (
              <SvgText
                key={`label-${index}`}
                x={pos.labelX}
                y={pos.labelY}
                textAnchor={pos.textAnchor}
                fontSize={14}
                fill="#000"
                dy="0.35em" // Center text vertically
              >
                {priorityAreas[index].name}
              </SvgText>
            );
          })}
        </Svg>
      </View>
      <View style={styles.summaryContainer}>
        {priorityAreas.map((area, index) => {
          console.log(`Rendering summary item for ${area.name}`);
          return (
            <View key={index} style={styles.summaryItem}>
              <Text style={styles.summaryTitle}>{area.name}</Text>
              <Text style={styles.summaryScore}>Score: {area.score}/10</Text>
              <Text style={styles.summaryExplanation}>{area.explanation}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  graphContainer: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
    overflow: 'visible',
    padding: 40,
    paddingLeft: 80,
    paddingBottom: 60,
  },
  svg: {
    width: '100%',
    height: 'auto',
    maxWidth: 1200,
  },
  summaryContainer: {
    marginTop: 16,
  },
  summaryItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryScore: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
  },
  summaryExplanation: {
    fontSize: 14,
    color: '#666',
  },
}); 