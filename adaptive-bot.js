/**
 * Adaptive Bot Difficulty System
 * Passt die Bot-Schwierigkeit automatisch an den Spieler an
 */

const AdaptiveBotSystem = (function() {
  'use strict';
  
  // Konfiguration
  const CONFIG = {
    minGamesForAnalysis: 5,
    adaptationInterval: 3, // Nach wie vielen Spielen angepasst wird
    maxAdaptationFactor: 0.3, // Maximale Anpassung pro Schritt
    storageKey: 'sd_adaptive_data',
    enabled: true
  };
  
  // Datenstruktur für Spielanalyse
  let adaptiveData = {
    games: [],
    currentDifficulty: 'easy',
    skillLevel: 'beginner',
    adaptationHistory: [],
    enabled: true
  };
  
  /**
   * Initialisiert das adaptive System
   */
  function init() {
    loadData();
    console.log('🤖 Adaptive Bot System initialisiert');
  }
  
  /**
   * Lädt gespeicherte Daten aus LocalStorage
   */
  function loadData() {
    try {
      const saved = localStorage.getItem(CONFIG.storageKey);
      if (saved) {
        adaptiveData = JSON.parse(saved);
        console.log('💾 Adaptive Daten geladen:', adaptiveData.games.length, 'Spiele');
      }
    } catch (e) {
      console.warn('⚠️ Konnte adaptive Daten nicht laden:', e);
    }
  }
  
  /**
   * Speichert Daten in LocalStorage
   */
  function saveData() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(adaptiveData));
    } catch (e) {
      console.warn('⚠️ Konnte adaptive Daten nicht speichern:', e);
    }
  }
  
  /**
   * Zeichnet ein Spiel auf
   */
  function trackGame(playerScore, botScore, discipline, difficulty, weapon) {
    if (!CONFIG.enabled || !adaptiveData.enabled) return;
    
    const gameData = {
      timestamp: Date.now(),
      playerScore: parseFloat(playerScore) || 0,
      botScore: parseFloat(botScore) || 0,
      discipline: discipline,
      difficulty: difficulty,
      weapon: weapon,
      scoreDifference: Math.abs(playerScore - botScore),
      playerWon: playerScore > botScore
    };
    
    adaptiveData.games.push(gameData);
    
    // Alte Spiele aufräumen (letzte 50 behalten)
    if (adaptiveData.games.length > 50) {
      adaptiveData.games = adaptiveData.games.slice(-50);
    }
    
    saveData();
    
    // Automatische Anpassung prüfen
    if (shouldAdapt()) {
      const newDifficulty = analyzePerformanceAndAdapt();
      if (newDifficulty && newDifficulty !== adaptiveData.currentDifficulty) {
        adaptiveData.currentDifficulty = newDifficulty;
        adaptiveData.adaptationHistory.push({
          timestamp: Date.now(),
          oldDifficulty: adaptiveData.currentDifficulty,
          newDifficulty: newDifficulty,
          reason: 'Auto-adaptation'
        });
        
        console.log(`🎯 Schwierigkeit angepasst: ${adaptiveData.currentDifficulty} → ${newDifficulty}`);
        
        // Event für UI-Updates
        window.dispatchEvent(new CustomEvent('difficultyAdapted', { 
          detail: { oldDifficulty: adaptiveData.currentDifficulty, newDifficulty: newDifficulty }
        }));
      }
    }
  }
  
  /**
   * Prüft ob eine Anpassung erfolgen sollte
   */
  function shouldAdapt() {
    if (adaptiveData.games.length < CONFIG.minGamesForAnalysis) return false;
    
    const gamesSinceLastAdapt = adaptiveData.games.length % CONFIG.adaptationInterval;
    return gamesSinceLastAdapt === 0;
  }
  
  /**
   * Analysiert die Performance und passt die Schwierigkeit an
   */
  function analyzePerformanceAndAdapt() {
    const recentGames = adaptiveData.games.slice(-CONFIG.adaptationInterval);
    
    if (recentGames.length === 0) return null;
    
    // Statistiken berechnen
    const avgPlayerScore = recentGames.reduce((sum, game) => sum + game.playerScore, 0) / recentGames.length;
    const avgBotScore = recentGames.reduce((sum, game) => sum + game.botScore, 0) / recentGames.length;
    const avgDifference = Math.abs(avgPlayerScore - avgBotScore);
    const winRate = recentGames.filter(game => game.playerWon).length / recentGames.length;
    
    // Konsistenz berechnen
    const scoreVariance = calculateVariance(recentGames.map(g => g.playerScore));
    const consistency = Math.max(0, 1 - (scoreVariance / 100)); // Normalisiert 0-1
    
    console.log(`📊 Performance-Analyse:`, {
      avgDifference: avgDifference.toFixed(1),
      winRate: (winRate * 100).toFixed(1) + '%',
      consistency: (consistency * 100).toFixed(1) + '%'
    });
    
    // Neue Schwierigkeit bestimmen
    return determineOptimalDifficulty(avgDifference, winRate, consistency);
  }
  
  /**
   * Bestimmt die optimale Schwierigkeit basierend auf Performance-Metriken
   */
  function determineOptimalDifficulty(avgDifference, winRate, consistency) {
    const currentDiff = adaptiveData.currentDifficulty;
    
    // Perfekte Balance: 50% Win-Rate, kleine Differenz, hohe Konsistenz
    const balanceScore = Math.abs(winRate - 0.5) * 2 + (avgDifference / 50) + (1 - consistency);
    
    // Schwierigkeitsstufen definieren
    const difficulties = ['easy', 'real', 'hard', 'elite'];
    const currentIndex = difficulties.indexOf(currentDiff);
    
    // Anpassungslogik
    if (balanceScore < 0.3 && winRate > 0.6) {
      // Spieler dominiert - erhöhe Schwierigkeit
      return difficulties[Math.min(currentIndex + 1, difficulties.length - 1)];
    } else if (balanceScore < 0.3 && winRate < 0.4) {
      // Bot dominiert - verringere Schwierigkeit
      return difficulties[Math.max(currentIndex - 1, 0)];
    } else if (consistency > 0.8 && avgDifference < 10) {
      // Sehr konstant und knapp - erhöhe leicht
      return difficulties[Math.min(currentIndex + 1, difficulties.length - 1)];
    }
    
    return currentDiff; // Keine Änderung
  }
  
  /**
   * Berechnet die Varianz eines Arrays
   */
  function calculateVariance(values) {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length);
  }
  
  /**
   * Gibt Empfehlungen für die nächste Schwierigkeit
   */
  function getDifficultyRecommendation() {
    if (adaptiveData.games.length < CONFIG.minGamesForAnalysis) {
      return {
        recommended: adaptiveData.currentDifficulty,
        reason: 'Noch nicht genügend Daten für Empfehlung',
        confidence: 0
      };
    }
    
    const recentGames = adaptiveData.games.slice(-Math.min(10, adaptiveData.games.length));
    const avgDifference = recentGames.reduce((sum, game) => sum + game.scoreDifference, 0) / recentGames.length;
    const winRate = recentGames.filter(game => game.playerWon).length / recentGames.length;
    
    let recommended = adaptiveData.currentDifficulty;
    let reason = '';
    let confidence = 0;
    
    if (winRate > 0.7 && avgDifference > 15) {
      recommended = getNextDifficulty(adaptiveData.currentDifficulty);
      reason = 'Sie gewinnen zu oft mit großem Vorsprung';
      confidence = 0.8;
    } else if (winRate < 0.3) {
      recommended = getPreviousDifficulty(adaptiveData.currentDifficulty);
      reason = 'Der Bot ist zu stark für Sie';
      confidence = 0.8;
    } else if (avgDifference < 5) {
      reason = 'Sehr ausgeglichene Spiele - perfekte Balance';
      confidence = 0.9;
    } else {
      reason = 'Aktuelle Schwierigkeit scheint passend';
      confidence = 0.6;
    }
    
    return { recommended, reason, confidence, winRate, avgDifference };
  }
  
  /**
   * Hilfsfunktionen für Schwierigkeitsstufen
   */
  function getNextDifficulty(current) {
    const difficulties = ['easy', 'real', 'hard', 'elite'];
    const currentIndex = difficulties.indexOf(current);
    return difficulties[Math.min(currentIndex + 1, difficulties.length - 1)];
  }
  
  function getPreviousDifficulty(current) {
    const difficulties = ['easy', 'real', 'hard', 'elite'];
    const currentIndex = difficulties.indexOf(current);
    return difficulties[Math.max(currentIndex - 1, 0)];
  }
  
  /**
   * Statistiken für die Anzeige
   */
  function getStatistics() {
    const games = adaptiveData.games;
    if (games.length === 0) return null;
    
    const totalGames = games.length;
    const wins = games.filter(g => g.playerWon).length;
    const winRate = wins / totalGames;
    const avgScore = games.reduce((sum, g) => sum + g.playerScore, 0) / totalGames;
    const avgDifference = games.reduce((sum, g) => sum + g.scoreDifference, 0) / totalGames;
    
    return {
      totalGames,
      wins,
      losses: totalGames - wins,
      winRate,
      avgScore,
      avgDifference,
      currentDifficulty: adaptiveData.currentDifficulty,
      skillLevel: adaptiveData.skillLevel
    };
  }
  
  /**
   * System ein-/ausschalten
   */
  function setEnabled(enabled) {
    adaptiveData.enabled = enabled;
    CONFIG.enabled = enabled;
    saveData();
    console.log(`🤖 Adaptive Bot System ${enabled ? 'aktiviert' : 'deaktiviert'}`);
  }
  
  /**
   * Zurücksetzen der Daten
   */
  function reset() {
    adaptiveData = {
      games: [],
      currentDifficulty: 'easy',
      skillLevel: 'beginner',
      adaptationHistory: [],
      enabled: true
    };
    saveData();
    console.log('🔄 Adaptive Bot Daten zurückgesetzt');
  }
  
  // Initialisierung beim Laden
  if (typeof window !== 'undefined') {
    init();
  }
  
  // Öffentliche API
  return {
    trackGame,
    getDifficultyRecommendation,
    getStatistics,
    setEnabled,
    reset,
    getCurrentDifficulty: () => adaptiveData.currentDifficulty,
    isEnabled: () => adaptiveData.enabled,
    CONFIG
  };
})();