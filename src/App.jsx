import { useEffect, useMemo, useRef, useState } from "react";

const SAVE_KEY = "crypto-miner-premium-save-v2";
const OFFLINE_LIMIT_HOURS = 5;
const FINAL_NET_WORTH = 250_000_000_000;
const PRESTIGE_REQUIREMENT = 1_000_000;
const AUTO_EVENT_EVERY_MS = 35_000;

const initialGame = {
  cash: 250,
  btc: 0,
  totalEarned: 0,
  stage: 0,
  prestigePoints: 0,
  totalPrestiges: 0,
  activeEvent: null,
  lastSave: Date.now(),
  lastAction: "Bienvenue dans ton empire de minage.",
  upgrades: {
    gpu: 0,
    cooling: 0,
    electricity: 0,
    automation: 0,
    security: 0,
    trading: 0,
  },
};

const stages = [
  {
    name: "Chambre",
    icon: "🛏️",
    required: 0,
    bonus: 1,
    desc: "Un vieux PC, une chaise, et beaucoup d’ambition.",
  },
  {
    name: "Coin bureau",
    icon: "💻",
    required: 5_000,
    bonus: 1.25,
    desc: "Ton setup devient sérieux, le bruit des ventilateurs commence.",
  },
  {
    name: "Garage",
    icon: "🏚️",
    required: 50_000,
    bonus: 1.75,
    desc: "Tu installes plusieurs rigs dans un espace dédié.",
  },
  {
    name: "Atelier sécurisé",
    icon: "🔐",
    required: 500_000,
    bonus: 2.7,
    desc: "Refroidissement propre, électricité stable, vraie organisation.",
  },
  {
    name: "Entrepôt crypto",
    icon: "🏭",
    required: 10_000_000,
    bonus: 4.4,
    desc: "Des racks partout. Tu n’es plus un amateur.",
  },
  {
    name: "Data Center",
    icon: "🌐",
    required: 1_000_000_000,
    bonus: 8,
    desc: "Ton infrastructure ressemble à celle d’une grosse entreprise.",
  },
  {
    name: "Empire mondial",
    icon: "👑",
    required: 25_000_000_000,
    bonus: 15,
    desc: "Tu domines le minage à l’échelle planétaire.",
  },
];

const upgradesInfo = {
  gpu: {
    title: "Cartes GPU",
    icon: "🖥️",
    desc: "Ajoute de la puissance brute à ton rig.",
    baseCost: 120,
    costGrowth: 1.42,
    basePower: 0.0000035,
    stat: "BTC/s",
  },
  cooling: {
    title: "Refroidissement",
    icon: "❄️",
    desc: "Réduit la chauffe et augmente la stabilité.",
    baseCost: 360,
    costGrowth: 1.5,
    multiplier: 0.085,
    stat: "Efficacité",
  },
  electricity: {
    title: "Électricité",
    icon: "⚡",
    desc: "Améliore l’alimentation et réduit les pertes.",
    baseCost: 700,
    costGrowth: 1.56,
    multiplier: 0.075,
    stat: "Rendement",
  },
  automation: {
    title: "Automation",
    icon: "🤖",
    desc: "Boost revenu AFK",
    baseCost: 1_600,
    costGrowth: 1.64,
    multiplier: 0.12,
    stat: "Optimisation",
  },
  security: {
    title: "Sécurité",
    icon: "🛡️",
    desc: "Protège ton infrastructure et tes wallets.",
    baseCost: 4_500,
    costGrowth: 1.72,
    multiplier: 0.1,
    stat: "Protection",
  },
  trading: {
    title: "Trading desk",
    icon: "📈",
    desc: "Convertit mieux ton BTC quand le marché bouge.",
    baseCost: 9_000,
    costGrowth: 1.82,
    multiplier: 0.09,
    stat: "Bonus vente",
  },
};


function getActiveEvent(game) {
  const event = game.activeEvent;
  if (!event) return null;
  if (!event.expiresAt || event.expiresAt <= Date.now()) return null;
  return event;
}

function getPrestigeMultiplier(game) {
  return 1 + (game.prestigePoints || 0) * 0.08;
}

function getEventMultiplier(game) {
  const event = getActiveEvent(game);

  if (!event) return 1;
  if (event.type === "pump") return 2.5;
  if (event.type === "outage") return 0.45;

  return 1;
}

function formatEventLabel(event) {
  if (!event) return "Aucun événement actif";
  if (event.type === "pump") return "BTC Pump x2.5";
  if (event.type === "outage") return "Panne électrique";
  return "Événement actif";
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "$0.00";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  if (value >= 100) return `$${value.toFixed(1)}`;
  return `$${value.toFixed(2)}`;
}

function formatBTC(value) {
  if (!Number.isFinite(value)) return "0.00000000";
  if (value < 0.000001) return value.toFixed(10);
  if (value < 0.001) return value.toFixed(8);
  return value.toFixed(6);
}

function getUpgradeCost(key, level) {
  const info = upgradesInfo[key];
  return Math.floor(info.baseCost * Math.pow(info.costGrowth, level));
}

function calculateStats(game, btcPrice) {
  const gpuLevel = game.upgrades.gpu;
  const coolingLevel = game.upgrades.cooling;
  const electricityLevel = game.upgrades.electricity;
  const automationLevel = game.upgrades.automation;
  const securityLevel = game.upgrades.security;
  const tradingLevel = game.upgrades.trading;

  const baseMining = 0.00004 + gpuLevel * 0.00004;
  const coolingBonus = 1 + coolingLevel * upgradesInfo.cooling.multiplier;
  const electricityBonus = 1 + electricityLevel * upgradesInfo.electricity.multiplier;
  const automationBonus = 1 + automationLevel * upgradesInfo.automation.multiplier;
  const securityBonus = 1 + securityLevel * upgradesInfo.security.multiplier;
  const tradingBonus = 1 + tradingLevel * upgradesInfo.trading.multiplier;
  const stageBonus = stages[game.stage]?.bonus || 1;
  const prestigeBonus = getPrestigeMultiplier(game);
  const eventBonus = getEventMultiplier(game);

  const btcPerSecond =
    baseMining *
    coolingBonus *
    electricityBonus *
    automationBonus *
    securityBonus *
    stageBonus *
    prestigeBonus *
    eventBonus;

  const sellMultiplier = tradingBonus;
  const cashPerSecond = btcPerSecond * btcPrice * sellMultiplier;
  const netWorth = game.cash + game.btc * btcPrice * sellMultiplier;
  const heat = Math.min(99, 38 + gpuLevel * 4 - coolingLevel * 3 + game.stage * 2);
  const energy = Math.max(1, 100 - electricityLevel * 4 + gpuLevel * 3);

  return {
    btcPerSecond,
    cashPerSecond,
    netWorth,
    sellMultiplier,
    heat,
    energy,
    hashrate: btcPerSecond * 1_000_000_000,
  };
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [saveReady, setSaveReady] = useState(false);
  const [game, setGame] = useState(initialGame);
  const [btcPrice, setBtcPrice] = useState(97250);
  const [marketDirection, setMarketDirection] = useState("up");
  const [offlineReward, setOfflineReward] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [eventChallenge, setEventChallenge] = useState(null);
  const [challengeTimeLeft, setChallengeTimeLeft] = useState(0);
  const [secretOpen, setSecretOpen] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  const [secretAmount, setSecretAmount] = useState("");
  const [secretBTC, setSecretBTC] = useState("");
  const [toast, setToast] = useState("");
  const [flashKey, setFlashKey] = useState("");
  const [particles, setParticles] = useState([]);
  const tickRef = useRef(Date.now());
  const particleIdRef = useRef(0);
  const challengeIdRef = useRef(0);
  const challengeResolvedRef = useRef(false);

  const stats = useMemo(() => calculateStats(game, btcPrice), [game, btcPrice]);
  const progress = Math.min((stats.netWorth / FINAL_NET_WORTH) * 100, 100);
  const nextStage = stages[game.stage + 1];
  const isFinished = stats.netWorth >= FINAL_NET_WORTH;
  const activeEvent = getActiveEvent(game);
  const canPrestige = stats.netWorth >= PRESTIGE_REQUIREMENT;

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2200);
  }

  function haptic(type = "light") {
    if (!navigator.vibrate) return;

    if (type === "success") navigator.vibrate([18, 30, 18]);
    else if (type === "error") navigator.vibrate(45);
    else navigator.vibrate(12);
  }

  function spawnBTCParticles(amount = 10) {
    const newParticles = Array.from({ length: amount }).map(() => ({
      id: particleIdRef.current++,
      left: 18 + Math.random() * 64,
      delay: Math.random() * 0.2,
      size: 14 + Math.random() * 10,
      drift: -28 + Math.random() * 56,
    }));

    setParticles((prev) => [...prev, ...newParticles]);

    window.setTimeout(() => {
      setParticles((prev) =>
        prev.filter((particle) => !newParticles.some((created) => created.id === particle.id))
      );
    }, 1600);
  }

  function isDevCodeValid() {
    if (secretCode.trim() !== "CASH") {
      haptic("error");
      showToast("Code secret incorrect.");
      return false;
    }

    return true;
  }


  function createCableSequence() {
    const colors = ["bleu", "orange", "vert"];
    return [...colors].sort(() => Math.random() - 0.5);
  }

  function openChallenge(challenge, seconds = 15) {
    challengeResolvedRef.current = false;
    setEventChallenge({
      ...challenge,
      duration: seconds,
    });
    setChallengeTimeLeft(seconds);
  }

  function useSecretCash() {
    if (!isDevCodeValid()) return;

    const amount = Number(secretAmount);

    if (!amount || amount <= 0) {
      haptic("error");
      showToast("Montant cash invalide.");
      return;
    }

    setGame((prev) => ({
      ...prev,
      cash: prev.cash + amount,
      lastAction: `Mode dev : +${formatMoney(amount)}`,
    }));

    setSecretAmount("");
    spawnBTCParticles(20);
    haptic("success");
    showToast(`+${formatMoney(amount)} ajouté 💰`);
  }

  function useSecretBTC() {
    if (!isDevCodeValid()) return;

    const amount = Number(secretBTC);

    if (!amount || amount <= 0) {
      haptic("error");
      showToast("Montant BTC invalide.");
      return;
    }

    setGame((prev) => ({
      ...prev,
      btc: prev.btc + amount,
      lastAction: `Mode dev : +${formatBTC(amount)} BTC`,
    }));

    setSecretBTC("");
    spawnBTCParticles(20);
    haptic("success");
    showToast(`+${formatBTC(amount)} BTC ajouté ₿`);
  }

  function devTriggerPump() {
    if (!isDevCodeValid()) return;

    const event = {
      type: "pump",
      title: "BTC Pump",
      message: "Mode dev : BTC Pump x2.5 actif.",
      expiresAt: Date.now() + 30_000,
    };

    setGame((prev) => ({
      ...prev,
      activeEvent: event,
      lastAction: event.message,
    }));

    spawnBTCParticles(18);
    haptic("success");
    showToast("BTC Pump déclenché 📈");
  }

  function devTriggerHack() {
    if (!isDevCodeValid()) return;

    const loss = Math.min(game.cash * 0.12, 75_000 + game.totalEarned * 0.02);

    openChallenge({
      type: "hack",
      title: "Hack détecté",
      message: "Mode dev : intrusion wallet. Injecte PATCH avant la fin du timer.",
      code: "PATCH",
      input: "",
      loss,
    }, 16);

    setSecretOpen(false);
    haptic("error");
    showToast("Hack déclenché 💀");
  }

  function devTriggerOutage() {
    if (!isDevCodeValid()) return;

    openChallenge({
      type: "outage",
      title: "Panne électrique",
      message: "Mode dev : répare les câbles dans l’ordre affiché.",
      sequence: createCableSequence(),
      currentStep: 0,
    }, 14);

    setSecretOpen(false);
    haptic("error");
    showToast("Panne déclenchée ⚡");
  }

  function devUnlockUpgrades() {
    if (!isDevCodeValid()) return;

    setGame((prev) => ({
      ...prev,
      upgrades: {
        gpu: 10,
        cooling: 10,
        electricity: 10,
        automation: 10,
        security: 10,
        trading: 10,
      },
      lastAction: "Mode dev : upgrades niveau 10",
    }));

    spawnBTCParticles(24);
    haptic("success");
    showToast("Upgrades niveau 10 débloqués 🚀");
  }

  function devResetOnlySave() {
    if (!isDevCodeValid()) return;

    localStorage.removeItem(SAVE_KEY);
    setGame({ ...initialGame, lastSave: Date.now() });
    setSecretCode("");
    setSecretAmount("");
    setSecretBTC("");
    setSecretOpen(false);
    setActiveTab("home");
    haptic("success");
    showToast("Sauvegarde reset.");
  }

  function closeDevMenu() {
    setSecretCode("");
    setSecretAmount("");
    setSecretBTC("");
    setSecretOpen(false);
  }

  function resolveChallenge(success) {
    if (!eventChallenge) return;
    if (challengeResolvedRef.current) return;
    challengeResolvedRef.current = true;

    if (eventChallenge.type === "hack") {
      if (success) {
        setGame((prev) => ({
          ...prev,
          lastAction: "Hack bloqué avec succès",
        }));
        showToast("Hack bloqué 🛡️");
        haptic("success");
      } else {
        const loss = eventChallenge.loss || 0;
        setGame((prev) => ({
          ...prev,
          cash: Math.max(0, prev.cash - loss),
          lastAction: `Hack subi : ${formatMoney(loss)} perdus`,
        }));
        showToast(`Hack subi 💀 -${formatMoney(loss)}`);
        haptic("error");
      }
    }

    if (eventChallenge.type === "outage") {
      if (success) {
        setGame((prev) => ({
          ...prev,
          activeEvent: null,
          lastAction: "Panne réparée",
        }));
        showToast("Panne réparée ⚡");
        haptic("success");
      } else {
        const event = {
          type: "outage",
          title: "Panne",
          message: "Panne électrique : production ralentie temporairement.",
          expiresAt: Date.now() + 18_000,
        };

        setGame((prev) => ({
          ...prev,
          activeEvent: event,
          lastAction: event.message,
        }));
        showToast("Panne non réparée : production ralentie");
        haptic("error");
      }
    }

    setEventChallenge(null);
  }

  useEffect(() => {
    const saved = localStorage.getItem(SAVE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const safeParsed = {
          ...initialGame,
          ...parsed,
          upgrades: { ...initialGame.upgrades, ...(parsed.upgrades || {}) },
          activeEvent: getActiveEvent(parsed),
        };

        const now = Date.now();
        const afkCapHours = OFFLINE_LIMIT_HOURS + (safeParsed.upgrades.automation || 0) * 2;
        const secondsOffline = Math.min(
          Math.max(0, (now - (safeParsed.lastSave || now)) / 1000),
          afkCapHours * 3600
        );

        const oldStats = calculateStats(safeParsed, btcPrice);
        const afkMultiplier = 1 + (safeParsed.upgrades.automation || 0) * 0.15;
        const earnedBTC = oldStats.btcPerSecond * secondsOffline * afkMultiplier;

        const restored = {
          ...safeParsed,
          btc: safeParsed.btc + earnedBTC,
          totalEarned: safeParsed.totalEarned + earnedBTC * btcPrice,
          lastSave: now,
        };

        setGame(restored);

        if (secondsOffline > 15 && earnedBTC > 0) {
          setOfflineReward({
            btc: earnedBTC,
            cash: earnedBTC * btcPrice,
            hours: secondsOffline / 3600,
          });
        }
      } catch {
        setGame({ ...initialGame, lastSave: Date.now() });
      }
    }

    setSaveReady(true);

    const timer = setTimeout(() => setLoading(false), 1400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!saveReady) return;

    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        ...game,
        lastSave: Date.now(),
      })
    );
  }, [game, saveReady]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = (now - tickRef.current) / 1000;
      tickRef.current = now;

      setGame((prev) => {
        const cleanEvent = getActiveEvent(prev);
        const cleanPrev = cleanEvent === prev.activeEvent ? prev : { ...prev, activeEvent: cleanEvent };

        const liveStats = calculateStats(cleanPrev, btcPrice);
        const minedBTC = liveStats.btcPerSecond * delta;

        let nextBTC = cleanPrev.btc + minedBTC;
        let nextCash = cleanPrev.cash;
        let autoSold = 0;

        if (cleanPrev.upgrades.trading > 0 && nextBTC > 0.00001) {
          const sellPercent = Math.min(0.35, 0.08 + cleanPrev.upgrades.trading * 0.015);
          autoSold = nextBTC * sellPercent;
          nextBTC -= autoSold;
          nextCash += autoSold * btcPrice * liveStats.sellMultiplier;
        }

        return {
          ...cleanPrev,
          btc: nextBTC,
          cash: nextCash,
          totalEarned: cleanPrev.totalEarned + minedBTC * btcPrice,
          lastAction:
            autoSold > 0
              ? `Vente auto : ${formatMoney(autoSold * btcPrice * liveStats.sellMultiplier)}`
              : cleanPrev.lastAction,
        };
      });
    }, 500);

    return () => clearInterval(interval);
  }, [btcPrice]);

  useEffect(() => {
    const market = setInterval(() => {
      setBtcPrice((price) => {
        const movement = 1 + (Math.random() - 0.47) * 0.018;
        const next = Math.max(55_000, Math.min(185_000, price * movement));
        setMarketDirection(next >= price ? "up" : "down");
        return next;
      });
    }, 3200);

    return () => clearInterval(market);
  }, []);

  useEffect(() => {
    const eventInterval = setInterval(() => {
      setGame((prev) => {
        if (getActiveEvent(prev)) return prev;
        if (Math.random() > 0.42) return prev;

        const roll = Math.random();

        if (roll < 0.45) {
          const event = {
            type: "pump",
            title: "BTC Pump",
            message: "Le marché explose : minage x2.5 pendant quelques secondes.",
            expiresAt: Date.now() + 22_000,
          };

          showToast("BTC Pump 📈 x2.5");
          spawnBTCParticles(14);

          return {
            ...prev,
            activeEvent: event,
            lastAction: event.message,
          };
        }

        if (roll < 0.78) {
          openChallenge({
            type: "outage",
            title: "Panne électrique",
            message: "Répare les câbles dans le bon ordre avant la fin du timer.",
            sequence: createCableSequence(),
            currentStep: 0,
          }, 14);

          showToast("Panne électrique ⚡ réparation requise");
          haptic("error");

          return {
            ...prev,
            lastAction: "Panne détectée : réparation requise",
          };
        }

        const loss = Math.min(prev.cash * 0.12, 75_000 + prev.totalEarned * 0.02);

        openChallenge({
          type: "hack",
          title: "Hack détecté",
          message: "Intrusion wallet détectée. Injecte le patch de sécurité avant la fin du timer.",
          code: "PATCH",
          input: "",
          loss,
        }, 16);

        showToast("Hack détecté 💀 action requise");
        haptic("error");

        return {
          ...prev,
          lastAction: "Hack détecté : action requise",
        };
      });
    }, AUTO_EVENT_EVERY_MS);

    return () => clearInterval(eventInterval);
  }, []);

  function buyUpgrade(key) {
    const level = game.upgrades[key];
    const cost = getUpgradeCost(key, level);

    if (stats.netWorth < cost) {
      haptic("error");
      showToast("Fonds insuffisants pour cet upgrade.");
      return;
    }

    setGame((prev) => {
      let nextCash = prev.cash;
      let nextBTC = prev.btc;

      if (nextCash >= cost) {
        nextCash -= cost;
      } else {
        const missing = cost - nextCash;
        nextCash = 0;
        nextBTC = Math.max(0, nextBTC - missing / btcPrice);
      }

      return {
        ...prev,
        cash: nextCash,
        btc: nextBTC,
        lastAction: `${upgradesInfo[key].title} amélioré niveau ${level + 1}`,
        upgrades: {
          ...prev.upgrades,
          [key]: level + 1,
        },
      };
    });

    setFlashKey(key);
    spawnBTCParticles(8);
    haptic("success");
    window.setTimeout(() => setFlashKey(""), 350);
    showToast(`${upgradesInfo[key].title} acheté ✅`);
  }

  function sellBTC() {
    if (game.btc <= 0) {
      showToast("Tu n’as pas encore de BTC à vendre.");
      return;
    }

    let soldAmount = 0;

    setGame((prev) => {
      const liveStats = calculateStats(prev, btcPrice);
      soldAmount = prev.btc * btcPrice * liveStats.sellMultiplier;

      return {
        ...prev,
        cash: prev.cash + soldAmount,
        btc: 0,
        lastAction: `BTC vendu pour ${formatMoney(soldAmount)}`,
      };
    });

    spawnBTCParticles(14);
    haptic("success");

    window.setTimeout(() => {
      showToast(`Vente réussie : ${formatMoney(soldAmount)}`);
    }, 0);
  }

  function upgradeStage() {
    if (!nextStage) {
      haptic("error");
      showToast("Tu as déjà le meilleur environnement.");
      return;
    }

    if (stats.netWorth < nextStage.required) {
      haptic("error");
      showToast(`Il faut ${formatMoney(nextStage.required)} de valeur nette.`);
      return;
    }

    setGame((prev) => ({
      ...prev,
      stage: prev.stage + 1,
      lastAction: `Nouvel environnement : ${nextStage.name}`,
    }));

    spawnBTCParticles(18);
    haptic("success");
    showToast(`Environnement amélioré : ${nextStage.name} 🚀`);
  }

  function prestigeReset() {
    if (!canPrestige) {
      haptic("error");
      showToast(`Prestige disponible à partir de ${formatMoney(PRESTIGE_REQUIREMENT)}.`);
      return;
    }

    const earnedPrestige = Math.max(1, Math.floor(Math.sqrt(stats.netWorth / PRESTIGE_REQUIREMENT)));

    const ok = window.confirm(
      `Prestige maintenant ? Tu gagnes ${earnedPrestige} points de prestige et tu recommences avec un bonus permanent.`
    );

    if (!ok) return;

    const nextGame = {
      ...initialGame,
      cash: 500,
      prestigePoints: (game.prestigePoints || 0) + earnedPrestige,
      totalPrestiges: (game.totalPrestiges || 0) + 1,
      lastAction: `Prestige réussi : +${earnedPrestige} points`,
      lastSave: Date.now(),
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(nextGame));
    setGame(nextGame);
    setActiveTab("home");
    setOfflineReward(null);
    spawnBTCParticles(24);
    haptic("success");
    showToast(`Prestige +${earnedPrestige} ✨`);
  }

  function resetGame() {
    const ok = window.confirm("Tu veux vraiment recommencer la partie ?");
    if (!ok) return;

    localStorage.removeItem(SAVE_KEY);
    setGame({ ...initialGame, lastSave: Date.now() });
    setActiveTab("home");
    setOfflineReward(null);
    showToast("Nouvelle partie lancée.");
  }

  if (loading) {
    return (
      <main className="app loading-screen">
        <div className="loading-orb">₿</div>
        <h1>Crypto Miner</h1>
        <p>Décryptage de l'app...</p>
        <div className="loader" />
      </main>
    );
  }

  return (
    <main className="app">
      <BackgroundCoder stage={game.stage} intensity={Math.min(1, stats.hashrate / 2500)} />

      <div className="btc-particles" aria-hidden="true">
        {particles.map((particle) => (
          <span
            key={particle.id}
            style={{
              left: `${particle.left}%`,
              animationDelay: `${particle.delay}s`,
              fontSize: `${particle.size}px`,
              "--drift": `${particle.drift}px`,
            }}
          >
            ₿
          </span>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}

      {offlineReward && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-icon">⛏️</div>
            <h2>Revenus hors ligne</h2>
            <p>
              Ton empire a miné pendant {offlineReward.hours.toFixed(1)}h.
              Limite actuelle : {OFFLINE_LIMIT_HOURS + game.upgrades.automation * 2}h.
            </p>
            <strong>{formatBTC(offlineReward.btc)} BTC</strong>
            <span>≈ {formatMoney(offlineReward.cash)}</span>
            <button onClick={() => setOfflineReward(null)}>Encaisser</button>
          </div>
        </div>
      )}


      {eventChallenge && (
        <div className="modal-backdrop">
          <div className="modal-card challenge-card">
            <div className="modal-icon">{eventChallenge.type === "hack" ? "💀" : "⚡"}</div>
            <h2>{eventChallenge.title}</h2>
            <p>{eventChallenge.message}</p>

            {eventChallenge.type === "hack" && (
              <>
                <div className="challenge-timer">
                  <span>Temps restant</span>
                  <strong>{challengeTimeLeft}s</strong>
                </div>

                <div className="hacker-console">
                  <div className="console-top">
                    <span className="red-dot" />
                    <span className="yellow-dot" />
                    <span className="green-dot" />
                    <b>root@wallet-security</b>
                  </div>
                  <div className="console-lines">
                    <span>&gt; intrusion_detected --wallet</span>
                    <span>&gt; firewall_status: CRITICAL</span>
                    <span>&gt; decrypting attack signature...</span>
                    <span>&gt; required_patch: <b>PATCH</b></span>
                  </div>
                </div>

                <input
                  className="secret-input hacker-input"
                  value={eventChallenge.input}
                  onChange={(e) =>
                    setEventChallenge((prev) => ({
                      ...prev,
                      input: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Tape PATCH"
                />

                <button onClick={() => resolveChallenge(eventChallenge.input === eventChallenge.code)}>
                  Injecter le patch
                </button>

                <button className="danger-button" onClick={() => resolveChallenge(false)}>
                  Abandonner
                </button>
              </>
            )}

            {eventChallenge.type === "outage" && (
              <>
                <div className="challenge-timer">
                  <span>Temps restant</span>
                  <strong>{challengeTimeLeft}s</strong>
                </div>

                <div className="cable-order">
                  <span>Ordre à suivre</span>
                  <strong>{eventChallenge.sequence.join(" → ")}</strong>
                </div>

                <div className="cable-row">
                  {["bleu", "orange", "vert"].map((cable) => (
                    <button
                      key={cable}
                      className={`cable ${cable}`}
                      onClick={() => {
                        const expected = eventChallenge.sequence[eventChallenge.currentStep];

                        if (cable !== expected) {
                          resolveChallenge(false);
                          return;
                        }

                        const nextStep = eventChallenge.currentStep + 1;

                        if (nextStep >= eventChallenge.sequence.length) {
                          resolveChallenge(true);
                          return;
                        }

                        setEventChallenge((prev) => ({
                          ...prev,
                          currentStep: nextStep,
                        }));
                      }}
                    >
                      {cable}
                    </button>
                  ))}
                </div>

                <p className="challenge-hint">
                  Étape {eventChallenge.currentStep + 1}/3 : clique sur {eventChallenge.sequence[eventChallenge.currentStep]}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {secretOpen && (
        <div className="modal-backdrop">
          <div className="modal-card challenge-card dev-card">
            <div className="modal-icon">🧪</div>
            <h2>Mode dev</h2>
            <p>Code secret : entre le code, puis choisis une action de test.</p>

            <input
              className="secret-input"
              value={secretCode}
              onChange={(e) => setSecretCode(e.target.value.toUpperCase())}
              placeholder="Code secret"
            />

            <div className="dev-grid">
              <input
                className="secret-input"
                value={secretAmount}
                onChange={(e) => setSecretAmount(e.target.value)}
                placeholder="Cash ex: 1000000"
                inputMode="numeric"
              />
              <button onClick={useSecretCash}>Ajouter cash</button>
            </div>

            <div className="dev-grid">
              <input
                className="secret-input"
                value={secretBTC}
                onChange={(e) => setSecretBTC(e.target.value)}
                placeholder="BTC ex: 1"
                inputMode="decimal"
              />
              <button onClick={useSecretBTC}>Ajouter BTC</button>
            </div>

            <div className="dev-actions">
              <button onClick={devTriggerPump}>BTC Pump</button>
              <button onClick={devTriggerHack}>Hack</button>
              <button onClick={devTriggerOutage}>Panne</button>
              <button onClick={devUnlockUpgrades}>Upgrades x10</button>
            </div>

            <button className="danger-button" onClick={devResetOnlySave}>
              Reset sauvegarde
            </button>

            <button className="danger-button" onClick={closeDevMenu}>
              Fermer
            </button>
          </div>
        </div>
      )}

      <button className="secret-button" onClick={() => setSecretOpen(true)} aria-label="Mode test">
        ·
      </button>

      <section className="app-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Bitcoin Mining Tycoon</p>
            <h1>Crypto Miner</h1>
          </div>
          <button className="icon-button" onClick={resetGame} aria-label="Recommencer">
            ↺
          </button>
        </header>

        {activeTab === "home" && (
          <>
            <section className="hero-card compact">
              <div className="btc-badge">₿</div>
              <div>
                <p className="muted">Valeur nette</p>
                <h2>{formatMoney(stats.netWorth)}</h2>
                <span className="tiny">{game.lastAction}</span>
              </div>
              <div className={`market-pill ${marketDirection}`}>
                <span>BTC</span>
                <strong>{formatMoney(btcPrice)}</strong>
              </div>
            </section>

            <section className="home-grid">
              <div className="mini-stat">
                <span>BTC</span>
                <strong>{formatBTC(game.btc)}</strong>
              </div>
              <div className="mini-stat">
                <span>Cash</span>
                <strong>{formatMoney(game.cash)}</strong>
              </div>
              <div className="mini-stat wide">
                <span>Revenu auto</span>
                <strong>{formatMoney(stats.cashPerSecond)}/s</strong>
              </div>
            </section>

            <section className="home-actions single-action">
              <button className="sell quick-sell" onClick={sellBTC} disabled={game.btc <= 0}>
                Vendre BTC
                <small>
                  {game.btc > 0
                    ? `≈ ${formatMoney(game.btc * btcPrice * stats.sellMultiplier)}`
                    : "Aucun BTC à vendre"}
                </small>
              </button>
            </section>

            <section className="home-summary">
              <div>
                <span>Environnement</span>
                <strong>
                  {stages[game.stage].icon} {stages[game.stage].name}
                </strong>
              </div>
              <div>
                <span>Objectif</span>
                <strong>{progress.toFixed(4)}%</strong>
              </div>
              <div className="wide">
                <span>Événement</span>
                <strong>{formatEventLabel(activeEvent)}</strong>
              </div>
            </section>
          </>
        )}

        {activeTab === "infos" && (
          <section className="panel">
            <div className="panel-head">
              <h3>Live dashboard</h3>
              <span className="live-dot">LIVE</span>
            </div>

            <div className="dashboard-row">
              <span>Hashrate simulé</span>
              <strong>{stats.hashrate.toFixed(2)} GH/s</strong>
            </div>
            <div className="dashboard-row">
              <span>BTC / seconde</span>
              <strong>{stats.btcPerSecond.toFixed(10)}</strong>
            </div>
            <div className="dashboard-row">
              <span>Température ferme</span>
              <strong className={stats.heat > 80 ? "danger" : ""}>{stats.heat.toFixed(0)}°C</strong>
            </div>
            <div className="dashboard-row">
              <span>Charge électrique</span>
              <strong>{stats.energy.toFixed(0)}%</strong>
            </div>

            <div className="info-note">
              Ici tu gardes les données techniques. L’accueil reste clean et rapide.
            </div>
          </section>
        )}

        {activeTab === "upgrades" && (
          <section className="upgrades">
            <div className="upgrade-environment-card">
              <div className="stage-info">
                <span>{stages[game.stage].icon}</span>
                <div>
                  <p className="muted">Environnement</p>
                  <h3>{stages[game.stage].name}</h3>
                  <small>{stages[game.stage].desc}</small>
                </div>
              </div>

              <button
                className="primary environment-button"
                disabled={!nextStage || stats.netWorth < nextStage.required}
                onClick={upgradeStage}
              >
                {nextStage ? `Débloquer ${nextStage.name}` : "Max"}
                {nextStage && <small>{formatMoney(nextStage.required)}</small>}
              </button>
            </div>

            {Object.keys(upgradesInfo).map((key) => {
              const info = upgradesInfo[key];
              const level = game.upgrades[key];
              const cost = getUpgradeCost(key, level);
              const canBuy = stats.netWorth >= cost;

              return (
                <button
                  key={key}
                  className={`upgrade-card ${canBuy ? "" : "locked"} ${
                    flashKey === key ? "flash" : ""
                  }`}
                  onClick={() => buyUpgrade(key)}
                >
                  <div className="upgrade-icon">{info.icon}</div>
                  <div>
                    <h3>{info.title}</h3>
                    <p>{info.desc}</p>
                    <span>
                      Niveau {level} • {info.stat}
                    </span>
                  </div>
                  <strong>{formatMoney(cost)}</strong>
                </button>
              );
            })}
          </section>
        )}

        {activeTab === "objectives" && (
          <section className="panel objectives">
            <section className={`final-card objectives-final ${isFinished ? "finished" : ""}`}>
              <div>
                <span>Objectif final</span>
                <strong>{isFinished ? "Tu es le plus riche du monde 👑" : "Plus riche du monde"}</strong>
              </div>
              <p>{progress.toFixed(5)}%</p>
              <div className="progress-track">
                <div style={{ width: `${progress}%` }} />
              </div>
            </section>

            <div className="prestige-card">
              <div>
                <span>Prestige</span>
                <strong>{game.prestigePoints || 0} points</strong>
                <p>Bonus permanent actuel : x{getPrestigeMultiplier(game).toFixed(2)}</p>
              </div>
              <button className="primary" disabled={!canPrestige} onClick={prestigeReset}>
                Prestige
                <small>{formatMoney(PRESTIGE_REQUIREMENT)}</small>
              </button>
            </div>

            <h3>Objectifs de progression</h3>
            {stages.map((stage, index) => {
              const done = game.stage >= index;
              return (
                <div className={`objective ${done ? "done" : ""}`} key={stage.name}>
                  <div>
                    <strong>
                      {stage.icon} {stage.name}
                    </strong>
                    <span>{formatMoney(stage.required)} valeur nette</span>
                  </div>
                  <b>{done ? "OK" : "LOCK"}</b>
                </div>
              );
            })}
          </section>
        )}

        <nav className="bottom-tabs">
          <button
            className={activeTab === "home" ? "active" : ""}
            onClick={() => setActiveTab("home")}
          >
            <span>⌂</span>
            Accueil
          </button>
          <button
            className={activeTab === "upgrades" ? "active" : ""}
            onClick={() => setActiveTab("upgrades")}
          >
            <span>⬆</span>
            Upgrades
          </button>
          <button
            className={activeTab === "infos" ? "active" : ""}
            onClick={() => setActiveTab("infos")}
          >
            <span>◷</span>
            Infos
          </button>
          <button
            className={activeTab === "objectives" ? "active" : ""}
            onClick={() => setActiveTab("objectives")}
          >
            <span>◎</span>
            Objectifs
          </button>
        </nav>
      </section>
    </main>
  );
}

function BackgroundCoder({ stage, intensity }) {
  return (
    <div
      className={`bg-scene stage-${stage}`}
      style={{
        "--mining-glow": 0.22 + intensity * 0.55,
        "--fan-speed": `${1.25 - intensity * 0.55}s`,
      }}
      aria-hidden="true"
    >
      <div className="ambient ambient-blue" />
      <div className="ambient ambient-orange" />

      <div className="data-center-wall">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="coder-scene">
        <div className="screen-glow" />
        <div className="coder">
          <div className="coder-head" />
          <div className="coder-hoodie" />
          <div className="coder-arm left" />
          <div className="coder-arm right" />
        </div>

        <div className="monitor">
          <div className="monitor-bar" />
          <div className="code-lines">
            <span>const btc = mineBlock();</span>
            <span>hashrate.optimize();</span>
            <span>rig.temperature.check();</span>
            <span>wallet.balance += reward;</span>
            <span>market.watch("BTC");</span>
            <span>cooling.boost();</span>
          </div>
        </div>

        <div className="keyboard">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>

        <div className="rig">
          <div />
          <div />
          <div />
        </div>

        <div className="server-racks">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
