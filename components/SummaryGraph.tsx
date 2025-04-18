import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Svg, Circle, Line, Text as SvgText } from 'react-native-svg';

interface PriorityArea {
  name: string;
  score: number;
  explanation: string;
}

interface SummaryGraphProps {
  priorityAreas: PriorityArea[];
}

export default function SummaryGraph({ priorityAreas }: SummaryGraphProps) {
  const centerX = 150;
  const centerY = 150;
  const radius = 100;
  const numAreas = priorityAreas.length;
  const angleStep = (2 * Math.PI) / numAreas;

  // Ensure we have valid data
  if (!priorityAreas || priorityAreas.length === 0) {
    return null;
  }

  const renderGraph = () => {
    if (Platform.OS === 'web') {
      // Web-specific rendering
      return (
        <div style={styles.webGraphContainer}>
          <svg width="300" height="300" style={styles.webSvg}>
            {priorityAreas.map((area, index) => {
              const angle = index * angleStep;
              const x = centerX + radius * Math.cos(angle);
              const y = centerY + radius * Math.sin(angle);
              
              const scoreRadius = (radius * area.score) / 10;
              const scoreX = centerX + scoreRadius * Math.cos(angle);
              const scoreY = centerY + scoreRadius * Math.sin(angle);

              return (
                <React.Fragment key={area.name}>
                  <line
                    x1={centerX}
                    y1={centerY}
                    x2={x}
                    y2={y}
                    stroke="#ccc"
                    strokeWidth="1"
                  />
                  <circle
                    cx={scoreX}
                    cy={scoreY}
                    r="5"
                    fill="#007AFF"
                  />
                  <text
                    x={x + 10 * Math.cos(angle)}
                    y={y + 10 * Math.sin(angle)}
                    fontSize="12"
                    fill="#000"
                    textAnchor="middle"
                  >
                    {area.name}
                  </text>
                </React.Fragment>
              );
            })}
          </svg>
        </div>
      );
    } else {
      // Native rendering
      return (
        <View style={styles.graphContainer}>
          <Svg width="300" height="300" style={styles.svg}>
            {priorityAreas.map((area, index) => {
              const angle = index * angleStep;
              const x = centerX + radius * Math.cos(angle);
              const y = centerY + radius * Math.sin(angle);
              
              const scoreRadius = (radius * area.score) / 10;
              const scoreX = centerX + scoreRadius * Math.cos(angle);
              const scoreY = centerY + scoreRadius * Math.sin(angle);

              return (
                <React.Fragment key={area.name}>
                  <Line
                    x1={centerX}
                    y1={centerY}
                    x2={x}
                    y2={y}
                    stroke="#ccc"
                    strokeWidth="1"
                  />
                  <Circle
                    cx={scoreX}
                    cy={scoreY}
                    r="5"
                    fill="#007AFF"
                  />
                  <SvgText
                    x={x + 10 * Math.cos(angle)}
                    y={y + 10 * Math.sin(angle)}
                    fontSize="12"
                    fill="#000"
                    textAnchor="middle"
                  >
                    {area.name}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Priority Areas Summary</Text>
      
      {renderGraph()}

      <View style={styles.summaryContainer}>
        {priorityAreas.map((area) => (
          <View key={area.name} style={styles.summaryItem}>
            <Text style={styles.areaName}>{area.name}</Text>
            <Text style={styles.score}>Score: {area.score}/10</Text>
            <Text style={styles.explanation}>{area.explanation}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  graphContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  webGraphContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  webSvg: {
    maxWidth: '100%',
    height: 'auto',
  },
  svg: {
    ...Platform.select({
      web: {
        maxWidth: '100%',
        height: 'auto',
      },
    }),
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
  areaName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  score: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
  },
  explanation: {
    fontSize: 14,
    color: '#666',
  },
}); 