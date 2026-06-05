import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Game Rules Data ── */
const RULES = {
  ar: {
    guideTitle: '📖 دليل اللعبة',
    guideSubtitle: 'تعلّم القواعد قبل بدء اللعبة',
    sections: [
      {
        id: 'overview',
        icon: '🎯',
        title: 'نظرة عامة على اللعبة',
        content: [
          { type: 'text', value: 'لعبة المافيا هي لعبة تفاعلية اجتماعية تعتمد على الخداع والذكاء. تنقسم اللاعبين إلى فريقين: فريق المافيا وفريق المواطنين.' },
          { type: 'highlight', icon: '🔴', title: 'هدف المافيا', value: 'القضاء على المواطنين حتى يتساوى عددهم مع المافيا أو يفوقونهم.' },
          { type: 'highlight', icon: '✅', title: 'هدف المواطنين', value: 'اكتشاف جميع أعضاء المافيا والتصويت لإخراجهم من اللعبة.' },
          { type: 'text', value: 'اللعبة تتطلب 4 لاعبين كحد أدنى و 15 كحد أقصى. كل لاعب يحصل على بطاقة سرية تحدد دوره في اللعبة.' },
        ],
      },
      {
        id: 'phases',
        icon: '🔄',
        title: 'مراحل اللعبة',
        content: [
          { type: 'phase', icon: '🎴', title: 'كشف البطاقات', color: '#f6c247', value: 'بعد توزيع البطاقات ينظر كل لاعب إلى بطاقته ويضغط استعداد. عندما يصبح الجميع مستعدين تبدأ أول ليلة.' },
          { type: 'phase', icon: '🌙', title: 'مرحلة الليل', color: '#8d65ff', value: 'يغمض الجميع أعينهم. تستيقظ المافيا وتختار ضحية واحدة من المواطنين، ولا يمكنها قتل أحد من فريق المافيا. ثم يستيقظ الطبيب ليختار من يحميه. ثم يستيقظ المختار (المحقق) ويتحقق من هوية لاعب. بعدها تأتي الأدوار الإضافية المفعّلة من المضيف.' },
          { type: 'phase', icon: '☀️', title: 'مرحلة النهار', color: '#f6c247', value: 'يستيقظ الجميع ويُعلن عن الضحايا (إن وُجدوا). يبدأ النقاش الحر حيث يحاول كل لاعب اكتشاف المافيا. يمكن للاعبين مشاركة شكوكهم ومناقشة الأدلة. مدة النقاش محددة بالوقت الذي اختاره المضيف.' },
          { type: 'phase', icon: '🗳️', title: 'مرحلة التصويت', color: '#22d6b5', value: 'بعد انتهاء النقاش، يصوّت كل لاعب لإخراج شخص يشتبه به. اللاعب الذي يحصل على أكبر عدد أصوات يُطرد ويُكشف دوره. في حالة التعادل، تُعاد جولة تصويت بين المتعادلين. يمكن أيضاً تخطي التصويت.' },
          { type: 'text', value: 'بعد كشف البطاقات تتكرر المراحل (ليل ← نهار ← تصويت) حتى يفوز أحد الفريقين.' },
        ],
      },
      {
        id: 'cards',
        icon: '🃏',
        title: 'البطاقات والأدوار',
        content: [
          { type: 'card', emoji: '🔴', name: 'المافيا', team: 'فريق المافيا', teamColor: '#ef3948', desc: 'الدور الأساسي للأشرار. تجتمع المافيا ليلاً لاختيار ضحية واحدة لقتلها. إذا كان هناك أكثر من مافيا، يجب أن يتفقوا على هدف واحد. خلال النهار، يتظاهرون بأنهم مواطنون أبرياء.' },
          { type: 'card', emoji: '🔍', name: 'المختار (المحقق)', team: 'فريق المواطنين', teamColor: '#22d6b5', desc: 'كل ليلة يختار لاعباً للتحقق من هويته. يعرف إذا كان الشخص مافيا أم مواطن. عليه استخدام هذه المعلومات بحكمة خلال النهار دون كشف هويته للمافيا.' },
          { type: 'card', emoji: '💊', name: 'الطبيب', team: 'فريق المواطنين', teamColor: '#22d6b5', desc: 'كل ليلة يختار لاعباً لحمايته من القتل. إذا اختارت المافيا نفس الشخص الذي يحميه الطبيب، ينجو الضحية!' },
          { type: 'card', emoji: '👤', name: 'المواطن العادي', team: 'فريق المواطنين', teamColor: '#22d6b5', desc: 'ليس لديه قدرة خاصة ليلاً. دوره الأساسي هو المشاركة في النقاش نهاراً والتصويت لإخراج المشتبه بهم. ذكاؤه في الملاحظة والتحليل هو سلاحه الوحيد.' },
        ],
      },
      {
        id: 'tips',
        icon: '💡',
        title: 'نصائح وإستراتيجيات',
        content: [
          { type: 'tip', icon: '🧠', value: 'راقب ردود أفعال اللاعبين عند إعلان الوفيات - المافيا قد لا تتفاجأ.' },
          { type: 'tip', icon: '🤫', value: 'إذا كنت المختار، لا تكشف هويتك مبكراً وإلا ستقتلك المافيا ليلاً.' },
          { type: 'tip', icon: '🎭', value: 'المافيا الذكية تشارك في النقاش وتوجه الشكوك نحو الأبرياء.' },
          { type: 'tip', icon: '⚖️', value: 'لا تصوّت عشوائياً! كل صوت خاطئ يُضعف فريق المواطنين.' },
          { type: 'tip', icon: '🛡️', value: 'الطبيب يجب أن ينوّع في حمايته ولا يحمي نفس الشخص دائماً.' },
        ],
      },
    ],
  },
  en: {
    guideTitle: '📖 Game Guide',
    guideSubtitle: 'Learn the rules before the game starts',
    sections: [
      {
        id: 'overview',
        icon: '🎯',
        title: 'Game Overview',
        content: [
          { type: 'text', value: 'Mafia is a social deduction party game based on deception and strategy. Players are divided into two teams: the Mafia team and the Citizens team.' },
          { type: 'highlight', icon: '🔴', title: 'Mafia Goal', value: 'Eliminate citizens until the Mafia equals or outnumbers them.' },
          { type: 'highlight', icon: '✅', title: 'Citizens Goal', value: 'Identify all Mafia members and vote them out of the game.' },
          { type: 'text', value: 'The game requires a minimum of 4 players and a maximum of 15. Each player receives a secret card that determines their role.' },
        ],
      },
      {
        id: 'phases',
        icon: '🔄',
        title: 'Phases of Play',
        content: [
          { type: 'phase', icon: '🎴', title: 'Card Reveal', color: '#f6c247', value: 'After cards are dealt, each player checks their card and marks ready. The first night begins when everyone is ready.' },
          { type: 'phase', icon: '🌙', title: 'Night Phase', color: '#8d65ff', value: 'Everyone closes their eyes. The Mafia wakes up and agrees on one citizen to kill; they cannot kill Mafia teammates. Then the Doctor chooses someone to protect. Then the Detective investigates one player. Enabled extra roles act after that.' },
          { type: 'phase', icon: '☀️', title: 'Day Phase', color: '#f6c247', value: 'Everyone wakes up and victims are announced. Free discussion begins where players try to identify the Mafia. Players share suspicions and debate evidence. Discussion time is set by the host.' },
          { type: 'phase', icon: '🗳️', title: 'Voting Phase', color: '#22d6b5', value: 'After discussion, each player votes to eliminate a suspect. The player with the most votes is eliminated and their role is revealed. In case of a tie, a re-vote occurs between tied players. Players can also skip voting.' },
          { type: 'text', value: 'After card reveal, phases repeat (Night → Day → Voting) until one team wins.' },
        ],
      },
      {
        id: 'cards',
        icon: '🃏',
        title: 'Cards & Roles',
        content: [
          { type: 'card', emoji: '🔴', name: 'Mafia', team: 'Mafia Team', teamColor: '#ef3948', desc: 'The core villain role. The Mafia meets at night to choose one victim to kill. If there are multiple Mafia members, they must agree on one target. During the day, they pretend to be innocent citizens.' },
          { type: 'card', emoji: '🔍', name: 'Detective', team: 'Citizens Team', teamColor: '#22d6b5', desc: 'Each night, chooses a player to investigate. Learns if they are Mafia or Citizen. Must use this information wisely during the day without revealing their identity to the Mafia.' },
          { type: 'card', emoji: '💊', name: 'Doctor', team: 'Citizens Team', teamColor: '#22d6b5', desc: 'Each night, chooses a player to protect from being killed. If the Mafia targets the same player the Doctor is protecting, the victim survives!' },
          { type: 'card', emoji: '👤', name: 'Villager', team: 'Citizens Team', teamColor: '#22d6b5', desc: 'Has no special night ability. Their main role is to participate in daytime discussions and vote out suspects. Observation and analysis skills are their only weapons.' },
        ],
      },
      {
        id: 'tips',
        icon: '💡',
        title: 'Tips & Strategies',
        content: [
          { type: 'tip', icon: '🧠', value: 'Watch players\' reactions when deaths are announced — Mafia may not seem surprised.' },
          { type: 'tip', icon: '🤫', value: 'If you\'re the Detective, don\'t reveal your identity early or the Mafia will kill you at night.' },
          { type: 'tip', icon: '🎭', value: 'Smart Mafia members actively participate in discussions and redirect suspicion toward innocents.' },
          { type: 'tip', icon: '⚖️', value: 'Don\'t vote randomly! Every wrong vote weakens the Citizens team.' },
          { type: 'tip', icon: '🛡️', value: 'The Doctor should vary their protection and not always protect the same person.' },
        ],
      },
    ],
  },
};

export default function GameRulesPanel({ language }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const rules = RULES[language] || RULES.ar;

  const toggleSection = (id) => {
    setOpenSection(prev => prev === id ? null : id);
  };

  return (
    <motion.div
      className="rules-panel mt-2"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <motion.button
        className="rules-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ borderColor: 'rgba(91, 157, 247, 0.5)' }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="rules-toggle-left">
          <span className="rules-toggle-icon">📖</span>
          <div>
            <div className="rules-toggle-title">{rules.guideTitle}</div>
            <div className="rules-toggle-sub">{rules.guideSubtitle}</div>
          </div>
        </div>
        <motion.span
          className="rules-chevron"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          ▼
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="rules-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="rules-sections">
              {rules.sections.map((section, si) => (
                <motion.div
                  key={section.id}
                  className="rules-section"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: si * 0.08 }}
                >
                  <motion.button
                    className={`rules-section-header ${openSection === section.id ? 'active' : ''}`}
                    onClick={() => toggleSection(section.id)}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
                    whileTap={{ scale: 0.995 }}
                  >
                    <span className="rules-section-icon">{section.icon}</span>
                    <span className="rules-section-title">{section.title}</span>
                    <motion.span
                      className="rules-chevron-sm"
                      animate={{ rotate: openSection === section.id ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      ▼
                    </motion.span>
                  </motion.button>

                  <AnimatePresence>
                    {openSection === section.id && (
                      <motion.div
                        className="rules-section-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="rules-content-inner">
                          {section.content.map((item, i) => (
                            <RuleItem key={i} item={item} index={i} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RuleItem({ item, index }) {
  if (item.type === 'text') {
    return (
      <motion.p className="rule-text" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}>
        {item.value}
      </motion.p>
    );
  }
  if (item.type === 'highlight') {
    return (
      <motion.div className="rule-highlight" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
        <span className="rule-highlight-icon">{item.icon}</span>
        <div><strong>{item.title}:</strong> {item.value}</div>
      </motion.div>
    );
  }
  if (item.type === 'phase') {
    return (
      <motion.div className="rule-phase" style={{ borderColor: `${item.color}44` }} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} whileHover={{ borderColor: `${item.color}88` }}>
        <div className="rule-phase-header">
          <span className="rule-phase-icon" style={{ backgroundColor: `${item.color}22`, color: item.color }}>{item.icon}</span>
          <strong style={{ color: item.color }}>{item.title}</strong>
        </div>
        <p className="rule-phase-desc">{item.value}</p>
      </motion.div>
    );
  }
  if (item.type === 'card') {
    return (
      <motion.div className="rule-card-item" style={{ borderColor: `${item.teamColor}33` }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ borderColor: `${item.teamColor}66`, y: -2 }}>
        <div className="rule-card-header">
          <span className="rule-card-emoji">{item.emoji}</span>
          <div className="rule-card-meta">
            <span className="rule-card-name">{item.name}</span>
            <span className="rule-card-team" style={{ color: item.teamColor }}>{item.team}</span>
          </div>
        </div>
        <p className="rule-card-desc">{item.desc}</p>
      </motion.div>
    );
  }
  if (item.type === 'divider') {
    return (<div className="rule-divider"><span>{item.label}</span></div>);
  }
  if (item.type === 'tip') {
    return (
      <motion.div className="rule-tip" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ backgroundColor: 'rgba(246, 194, 71, 0.08)' }}>
        <span className="rule-tip-icon">{item.icon}</span>
        <span>{item.value}</span>
      </motion.div>
    );
  }
  return null;
}
