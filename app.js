const { useState, useEffect, useRef } = React;
const API_URL = "/plan";

async function fetchPlan(location, startDate, endDate) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location, startDate, endDate }),
  });
  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok) {
    if (payload && payload.fieldErrors) {
      const err = new Error('Validation failed');
      err.fieldErrors = payload.fieldErrors;
      throw err;
    }
    throw new Error((payload && payload.error) || `Server returned ${response.status}`);
  }
  return payload;
}

const ATTRACTION_EMOJI = {
  Landmark: '🗼',
  Museum: '🏛️',
  Historic: '🏯',
  Nature: '🌳',
  Cultural: '🎭',
  'Theme Park': '🎢',
  Zoo: '🦁',
};

const TIME_EMOJI = {
  Morning: '🌅',
  Afternoon: '🌤️',
  Evening: '🌙',
};

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
  return Math.abs(h);
}

function gradientClassFor(seed) {
  return `gradient-${(hashString(seed) % 8) + 1}`;
}

function formatNiceDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatShortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

/* ----- SmartImage ----- */
function SmartImage({ imageUrl, fallbackEmoji, seed, alt = '', className = '', emojiSize = 'text-7xl' }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const gradient = gradientClassFor(seed || alt || fallbackEmoji || 'x');

  useEffect(() => { setLoaded(false); setFailed(false); }, [imageUrl]);

  const showImage = !!imageUrl && !failed;

  return (
    <div className={`visual-header ${gradient} ${className}`}>
      <div
        className={`emoji ${emojiSize}`}
        style={{ opacity: loaded && showImage ? 0 : 1, transition: 'opacity 0.5s' }}
      >
        {fallbackEmoji}
      </div>
      {showImage && !loaded && <div className="img-shimmer" />}
      {showImage && (
        <img
          src={imageUrl}
          alt={alt}
          className={`smart-img ${loaded ? 'loaded' : ''}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

/* ----- StepScroller ----- */
function StepScroller({ steps, currentIndex }) {
  const translateY = 120 - currentIndex * 120;
  return (
    <div className="step-scroller relative overflow-hidden w-full max-w-2xl mx-auto">
      <div className="step-fade-top absolute inset-x-0 top-0 z-20 pointer-events-none" />
      <div className="step-fade-bottom absolute inset-x-0 bottom-0 z-20 pointer-events-none" />
      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 z-0 pointer-events-none step-row">
        <div className="absolute inset-0 rounded-2xl animate-glow-ring"
          style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid var(--line)' }}></div>
      </div>
      <div className="relative z-10"
        style={{ transform: `translateY(${translateY}px)`, transition: 'transform 1s var(--ease-out-expo)' }}>
        {steps.map((step, i) => {
          const isActive = i === currentIndex;
          const isDone = i < currentIndex;
          const distance = Math.abs(i - currentIndex);
          let opacity = 1, scale = 1;
          if (distance === 1) { opacity = 0.4; scale = 0.93; }
          else if (distance >= 2) { opacity = 0.15; scale = 0.86; }
          return (
            <div key={i} className="step-row flex items-center gap-5 px-5"
              style={{ opacity, transform: `scale(${scale})`,
                transition: 'opacity 0.9s var(--ease-out-expo), transform 0.9s var(--ease-out-expo)' }}>
              <div className="flex-shrink-0">
                {isActive ? (
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center animate-pulse-glow"
                    style={{ background: 'var(--accent)' }}>
                    <div className="step-spinner"></div>
                  </div>
                ) : isDone ? (
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: 'rgba(212, 165, 116, 0.1)', color: 'var(--accent)',
                             border: '1px solid rgba(212, 165, 116, 0.25)' }}>✓</div>
                ) : (
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center font-medium"
                    style={{ background: 'var(--bg-2)', color: 'var(--text-mute)', border: '1px solid var(--line)' }}>
                    {i + 1}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium leading-tight"
                  style={{ fontSize: isActive ? '1.5rem' : '1rem',
                    color: isActive ? 'var(--text)' : 'var(--text-dim)',
                    transition: 'font-size 0.65s var(--ease-out-expo), color 0.6s ease',
                    fontFamily: isActive ? "'Instrument Serif', Georgia, serif" : 'inherit',
                    letterSpacing: isActive ? '-0.01em' : '0' }}>
                  {step.title}
                </div>
                <div style={{ fontSize: isActive ? '0.9rem' : '0.78rem',
                  color: 'var(--text-mute)', marginTop: '4px',
                  transition: 'font-size 0.65s var(--ease-out-expo)' }}>
                  {step.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----- ItineraryPlanner ----- */
function ItineraryPlanner({ itinerary, tempUnit }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const timelineRef = useRef(null);

  if (!Array.isArray(itinerary) || itinerary.length === 0) return null;

  const total = itinerary.length;
  const clamped = Math.min(activeIdx, total - 1);

  const goTo = (i) => setActiveIdx(Math.max(0, Math.min(total - 1, i)));
  const goPrev = () => goTo(clamped - 1);
  const goNext = () => goTo(clamped + 1);

  useEffect(() => {
    if (!timelineRef.current) return;
    const dot = timelineRef.current.querySelector(`[data-day="${clamped}"]`);
    if (dot) dot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [clamped]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clamped, total]);

  return (
    <div className="surface rounded-2xl p-6 md:p-10 animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
      {/* Header */}
      <div className="mb-7 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h3 className="font-serif text-3xl md:text-4xl font-normal mb-1" style={{ color: 'var(--text)' }}>
            Your day-by-day itinerary
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-mute)' }}>
            Crafted around the weather and the places you'll love
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={clamped === 0}
            aria-label="Previous day"
            className="nav-arrow"
          >‹</button>
          <div className="text-xs font-medium px-3" style={{ color: 'var(--text-mute)' }}>
            Day {clamped + 1} <span className="opacity-50">/ {total}</span>
          </div>
          <button
            onClick={goNext}
            disabled={clamped === total - 1}
            aria-label="Next day"
            className="nav-arrow"
          >›</button>
        </div>
      </div>

      {/* Timeline dots */}
      <div ref={timelineRef} className="day-timeline mb-6 scroll-x">
        {itinerary.map((d, i) => (
          <div
            key={i}
            data-day={i}
            onClick={() => goTo(i)}
            className={`day-dot ${i === clamped ? 'is-active' : ''}`}
          >
            <div className="dot-label">{formatShortDate(d.date) || `D${i + 1}`}</div>
            <div className="dot-mark"></div>
          </div>
        ))}
      </div>

      {/* Stage */}
      <div className="itinerary-stage">
        <div
          className="itinerary-track"
          style={{ transform: `translateX(-${clamped * 100}%)` }}
        >
          {itinerary.map((day, i) => {
            const isActive = i === clamped;
            return (
              <div key={i} className={`itinerary-slide ${isActive ? '' : 'is-inactive'}`}>
                {isActive ? (
                  <DayCard day={day} tempUnit={tempUnit} />
                ) : (
                  <DayCard day={day} tempUnit={tempUnit} muted />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayCard({ day, tempUnit, muted = false }) {
  const w = day.weather || {};
  return (
    <div className={muted ? '' : 'day-card-inner'}>
      {/* Top row: date / title / weather */}
      <div className="grid md:grid-cols-3 gap-4 mb-6 items-stretch">
        {/* Title block */}
        <div className="surface-elevated rounded-xl p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
              Day {day.day_number || 1}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-mute)' }}>·</span>
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {formatNiceDate(day.date)}
            </span>
          </div>
          <h4 className="font-serif text-3xl md:text-4xl leading-tight mb-3" style={{ color: 'var(--text)' }}>
            {day.title || 'Day plan'}
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            {day.vibe && <span className="vibe-pill">✦ {day.vibe}</span>}
          </div>
          {day.weather_summary && (
            <p className="text-sm leading-relaxed mt-4" style={{ color: 'var(--text-dim)' }}>
              {day.weather_summary}
            </p>
          )}
        </div>

        {/* Weather mini card */}
        <div className="surface-elevated rounded-xl p-5 flex flex-col justify-center items-center text-center">
          <div className="text-5xl mb-2 opacity-90">{w.icon || '🌤️'}</div>
          {(w.high != null || w.low != null) ? (
            <div className="font-serif text-3xl leading-none" style={{ color: 'var(--text)' }}>
              {w.high}{tempUnit}
              <span className="text-base font-sans ml-2" style={{ color: 'var(--text-mute)' }}>
                / {w.low}{tempUnit}
              </span>
            </div>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-mute)' }}>Forecast n/a</div>
          )}
          {w.condition && (
            <div className="text-xs mt-2 uppercase tracking-wider" style={{ color: 'var(--text-mute)' }}>
              {w.condition}
            </div>
          )}
        </div>
      </div>

      {/* Activities */}
      <div className="grid md:grid-cols-3 gap-4 mb-5">
        {(day.activities || []).map((act, idx) => (
          <div key={idx} className="activity-card" style={{ animationDelay: `${0.1 + idx * 0.08}s` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="activity-time-badge">
                <span>{TIME_EMOJI[act.time] || '⏱'}</span>
                <span>{act.time || ''}</span>
              </span>
              {act.duration && (
                <span className="text-xs" style={{ color: 'var(--text-mute)' }}>{act.duration}</span>
              )}
            </div>
            <div className="flex items-start gap-3 mb-2">
              <div className="text-2xl flex-shrink-0 leading-none mt-0.5">{act.icon || '📍'}</div>
              <div className="min-w-0">
                <h5 className="font-serif text-xl leading-tight" style={{ color: 'var(--text)' }}>
                  {act.title || '—'}
                </h5>
                {act.location && (
                  <div className="text-xs mt-1" style={{ color: 'var(--accent)' }}>
                    {act.location}
                  </div>
                )}
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
              {act.description || ''}
            </p>
          </div>
        ))}
      </div>

      {/* Tip */}
      {day.tip && (
        <div className="tip-card">
          <div className="text-xl flex-shrink-0">💡</div>
          <div>
            <div className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
              Today's tip
            </div>
            <div className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
              {day.tip}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----- Main component ----- */
function TravelPlanner() {
  const [location, setLocation]   = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [results, setResults]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState({});
  const [stepIndex, setStepIndex] = useState(0);
  const [apiError, setApiError]   = useState(null);
  const resultsRef = useRef(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const popular = ['Paris', 'Tokyo', 'Reykjavik', 'Cape Town', 'Kyoto', 'Buenos Aires', 'Marrakech', 'Queenstown'];

  const loadingSteps = [
    { title: 'Connecting',              subtitle: 'Establishing a secure link to the travel service' },
    { title: 'Researching destination', subtitle: 'Gathering data about your chosen location' },
    { title: 'Curating attractions',    subtitle: 'Finding must-see places and hidden gems' },
    { title: 'Selecting hotels',        subtitle: 'Choosing accommodations across all budgets' },
    { title: 'Checking the weather',    subtitle: 'Analysing forecasts for your travel dates' },
    { title: 'Building your itinerary', subtitle: 'Pairing activities to the weather of each day' },
    { title: 'Finalising your plan',    subtitle: 'Putting all the pieces together' },
  ];

  const handleSearch = async () => {
    setErrors({}); setApiError(null); setResults(null);

    const localErrors = {};
    if (!location.trim()) localErrors.location = 'Please enter a destination';
    if (!startDate) localErrors.startDate = 'Start date is required';
    if (!endDate)   localErrors.endDate   = 'End date is required';
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      localErrors.endDate = 'End date must be after start date';
    }
    if (Object.keys(localErrors).length > 0) { setErrors(localErrors); return; }

    setLoading(true); setStepIndex(0);
    const interval = setInterval(() => {
      setStepIndex(i => Math.min(i + 1, loadingSteps.length - 2));
    }, 1600);

    try {
      const data = await fetchPlan(location.trim(), startDate, endDate);
      clearInterval(interval);
      setStepIndex(loadingSteps.length - 1);
      await new Promise(r => setTimeout(r, 600));
      setResults(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (err) {
      clearInterval(interval);
      if (err.fieldErrors) {
        setErrors(err.fieldErrors);
      } else {
        const msg = err && err.message ? err.message : String(err);
        const isNetwork = /Failed to fetch|NetworkError|TypeError/i.test(msg);
        setApiError(isNetwork
          ? "Couldn't reach the backend. Make sure server.py is running on port 5000."
          : msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const pickCity = (c) => {
    setLocation(c);
    setErrors(e => ({ ...e, location: undefined }));
  };

  const resetForm = () => {
    setResults(null); setApiError(null); setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderStars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  const tempUnit = results?.weather?.unit ? `°${results.weather.unit}` : '°C';

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-10 relative">
      <div className="fixed inset-0 grid-pattern opacity-30 pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative">

        {/* Header */}
        <div className="text-center mb-12 pt-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 tag-accent text-xs font-medium tracking-wide animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
            Travel Planner
          </div>
          <h1 className="font-serif text-6xl md:text-7xl lg:text-8xl font-normal mb-4 leading-none" style={{ color: 'var(--text)' }}>
            Plan your <em className="accent-text italic">next</em> escape.
          </h1>
          <p className="text-base md:text-lg max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            Discover destinations, hotels, and weather forecasts anywhere in the world.
          </p>
        </div>

        {/* Search form */}
        <div className="surface-glass rounded-2xl p-6 md:p-8 mb-8 animate-fade-in-scale" style={{ animationDelay: '0.15s' }}>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-2 ml-0.5 tracking-wide" style={{ color: 'var(--text-mute)' }}>Destination</label>
              <input type="text" placeholder="Anywhere in the world..." value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className={`w-full p-3.5 rounded-lg ${errors.location ? 'input-error animate-shake' : ''}`} />
              {errors.location && <p className="text-xs mt-1.5 ml-0.5" style={{ color: 'var(--danger)' }}>{errors.location}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-2 ml-0.5 tracking-wide" style={{ color: 'var(--text-mute)' }}>Check in</label>
              <input type="date" value={startDate} min={todayStr}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full p-3.5 rounded-lg ${errors.startDate ? 'input-error animate-shake' : ''}`} />
              {errors.startDate && <p className="text-xs mt-1.5 ml-0.5" style={{ color: 'var(--danger)' }}>{errors.startDate}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-2 ml-0.5 tracking-wide" style={{ color: 'var(--text-mute)' }}>Check out</label>
              <input type="date" value={endDate} min={startDate || todayStr}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full p-3.5 rounded-lg ${errors.endDate ? 'input-error animate-shake' : ''}`} />
              {errors.endDate && <p className="text-xs mt-1.5 ml-0.5" style={{ color: 'var(--danger)' }}>{errors.endDate}</p>}
            </div>
          </div>

          {!results && !loading && (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium" style={{ color: 'var(--text-mute)' }}>Try:</span>
              {popular.map((c, i) => (
                <button key={c} onClick={() => pickCity(c)}
                  className="suggestion-pill px-3 py-1.5 rounded-full font-medium animate-fade-in"
                  style={{ animationDelay: `${0.3 + i * 0.05}s` }}>{c}</button>
              ))}
            </div>
          )}

          <button onClick={handleSearch} disabled={loading}
            className="btn-primary w-full mt-6 font-medium py-3.5 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed tracking-wide">
            {loading ? 'Planning your trip…' : 'Plan my trip'}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="surface rounded-2xl p-6 md:p-10 mb-6 animate-fade-in-scale overflow-hidden">
            <div className="text-center mb-2">
              <div className="text-xs font-medium tracking-wider uppercase" style={{ color: 'var(--accent)' }}>
                Building your itinerary
              </div>
              <div className="font-serif text-2xl md:text-3xl mt-2" style={{ color: 'var(--text)' }}>
                One moment please…
              </div>
            </div>
            <StepScroller steps={loadingSteps} currentIndex={stepIndex} />
            <div className="mt-2 max-w-2xl mx-auto px-5">
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${((stepIndex + 1) / loadingSteps.length) * 100}%`,
                    background: 'var(--accent)', transition: 'width 1s var(--ease-out-expo)' }}></div>
              </div>
              <div className="text-xs mt-2 text-right font-medium" style={{ color: 'var(--text-mute)' }}>
                Step {stepIndex + 1} of {loadingSteps.length}
              </div>
            </div>
          </div>
        )}

        {/* API error */}
        {apiError && !loading && (
          <div className="rounded-2xl p-5 mb-6 animate-fade-in-scale"
            style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div className="flex items-start gap-3">
              <div className="text-xl flex-shrink-0">⚠</div>
              <div>
                <h3 className="font-medium mb-1" style={{ color: '#fca5a5' }}>Something went wrong</h3>
                <p className="text-sm" style={{ color: '#f87171' }}>{apiError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <div ref={resultsRef} className="space-y-6">

            {/* Hero */}
            <div className="relative rounded-2xl overflow-hidden hero-min-height animate-fade-in-up surface">
              <SmartImage imageUrl={results.image} fallbackEmoji="🌍" seed={results.city} alt={results.city}
                className="absolute inset-0 w-full h-full" emojiSize="text-9xl" />
              <div className="absolute inset-0 z-10" style={{
                background: 'linear-gradient(to top, rgba(10, 10, 11, 0.95) 0%, rgba(10, 10, 11, 0.5) 50%, rgba(10, 10, 11, 0.2) 100%)'
              }}></div>
              <div className="relative z-20 p-7 md:p-12 hero-min-height flex flex-col justify-end">
                <div className="text-xs font-medium uppercase tracking-widest mb-3 animate-fade-in flex items-center gap-2"
                  style={{ color: 'var(--accent)', animationDelay: '0.4s' }}>
                  <span className="w-3 h-px" style={{ background: 'var(--accent)' }}></span>
                  Your destination
                </div>
                <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl font-normal mb-4 animate-fade-in-up leading-none"
                  style={{ animationDelay: '0.5s', color: 'var(--text)' }}>
                  {results.city}
                </h2>
                {results.coords && (
                  <p className="text-sm md:text-base animate-fade-in-up"
                    style={{ animationDelay: '0.7s', color: 'var(--text-dim)' }}>
                    {Number(results.coords.lat).toFixed(2)}°, {Number(results.coords.lon).toFixed(2)}°
                    <span className="mx-3 opacity-40">·</span>
                    {startDate} → {endDate}
                  </p>
                )}
              </div>
            </div>

            {/* Attractions */}
            {Array.isArray(results.attractions) && results.attractions.length > 0 && (
              <div className="surface rounded-2xl p-6 md:p-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="mb-7">
                  <h3 className="font-serif text-3xl md:text-4xl font-normal mb-1" style={{ color: 'var(--text)' }}>Top places to visit</h3>
                  <p className="text-sm" style={{ color: 'var(--text-mute)' }}>Curated highlights from your destination</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {results.attractions.map((p, i) => (
                    <div key={i} className="card-hover surface-elevated rounded-xl overflow-hidden animate-fade-in-up"
                      style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                      <div className="relative">
                        <SmartImage imageUrl={p.image} fallbackEmoji={ATTRACTION_EMOJI[p.type] || '🏛️'}
                          seed={p.name + (p.type || '')} alt={p.name} className="aspect-video" emojiSize="text-7xl" />
                        <span className="absolute top-3 left-3 text-xs font-medium px-2.5 py-1 rounded-md tag-accent z-10 backdrop-blur">
                          {p.type || 'Attraction'}
                        </span>
                      </div>
                      <div className="p-5">
                        <h4 className="font-serif text-xl mb-2 leading-tight" style={{ color: 'var(--text)' }}>{p.name}</h4>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>{p.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hotels */}
            {Array.isArray(results.hotels) && results.hotels.length > 0 && (
              <div className="surface rounded-2xl p-6 md:p-10 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="mb-7">
                  <h3 className="font-serif text-3xl md:text-4xl font-normal mb-1" style={{ color: 'var(--text)' }}>Recommended hotels</h3>
                  <p className="text-sm" style={{ color: 'var(--text-mute)' }}>Picks across budget, mid-range, and luxury</p>
                </div>
                <div className="grid lg:grid-cols-2 gap-5">
                  {results.hotels.map((h, i) => (
                    <div key={i} className="card-hover surface-elevated rounded-xl overflow-hidden flex flex-col sm:flex-row animate-fade-in-up"
                      style={{ animationDelay: `${0.4 + i * 0.08}s` }}>
                      <div className="sm:w-2/5 relative overflow-hidden hotel-image-area flex-shrink-0">
                        <SmartImage imageUrl={h.image} fallbackEmoji="🏨" seed={h.name} alt={h.name}
                          className="w-full h-full min-h-[240px]" emojiSize="text-8xl" />
                        <div className="absolute top-3 left-3 star-rating text-xs px-2.5 py-1 rounded-md z-10 backdrop-blur"
                          style={{ background: 'rgba(10, 10, 11, 0.7)', border: '1px solid var(--line)' }}>
                          {renderStars(h.stars || 3)}
                        </div>
                      </div>
                      <div className="flex-1 p-5 flex flex-col">
                        <h4 className="font-serif text-xl mb-3 leading-tight" style={{ color: 'var(--text)' }}>{h.name}</h4>
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {(h.features || []).map((f, j) => (
                            <span key={j} className="text-xs tag px-2.5 py-1 rounded-md font-medium">{f}</span>
                          ))}
                        </div>
                        <div className="mt-auto flex items-end justify-between pt-3" style={{ borderTop: '1px solid var(--line)' }}>
                          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-mute)' }}>From</div>
                          <div className="text-right">
                            <div className="font-serif text-3xl leading-none" style={{ color: 'var(--accent)' }}>${h.price}</div>
                            <div className="text-xs uppercase tracking-wider mt-1" style={{ color: 'var(--text-mute)' }}>per night</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weather */}
            {results.weather && (
              <div className="surface rounded-2xl p-6 md:p-10 relative overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <div className="absolute -top-12 -right-12 text-9xl opacity-5 animate-float">☁</div>
                <div className="absolute -bottom-8 -left-8 text-8xl opacity-5 animate-spin-slow">❄</div>
                <div className="relative z-10">
                  <div className="mb-7 flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-serif text-3xl md:text-4xl font-normal mb-1" style={{ color: 'var(--text)' }}>Weather forecast</h3>
                      <p className="text-sm" style={{ color: 'var(--text-mute)' }}>
                        {results.weather.error ? 'Forecast unavailable' : (results.weather.condition || '')}
                      </p>
                    </div>
                    {!results.weather.error && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-md tag-accent self-start"
                        title="Temperatures shown in degrees Celsius">Temperatures in °C</span>
                    )}
                  </div>

                  {results.weather.error ? (
                    <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{results.weather.error}</p>
                  ) : (
                    <>
                      <div className="grid md:grid-cols-2 gap-7 items-center mb-8">
                        <div className="flex items-center gap-6">
                          <div className="text-7xl md:text-8xl animate-float opacity-90">{results.weather.icon || '☀️'}</div>
                          <div>
                            <div className="font-serif text-6xl md:text-7xl leading-none" style={{ color: 'var(--text)' }}>
                              {results.weather.avg}{tempUnit}
                            </div>
                            <div className="text-sm mt-2" style={{ color: 'var(--text-mute)' }}>Average temperature</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {[
                            { label: `High (${tempUnit})`, value: `${results.weather.high}${tempUnit}` },
                            { label: `Low (${tempUnit})`,  value: `${results.weather.low}${tempUnit}` },
                            { label: 'Rain', value: results.weather.rain, unit: 'mm' },
                            { label: 'Wind', value: results.weather.wind, unit: 'km/h' },
                          ].map((stat, idx) => (
                            <div key={idx} className="surface-elevated rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-mute)' }}>{stat.label}</div>
                              <div className="font-serif text-3xl mt-1" style={{ color: 'var(--text)' }}>
                                {stat.value}
                                {stat.unit && <span className="text-base font-sans ml-1" style={{ color: 'var(--text-mute)' }}>{stat.unit}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {Array.isArray(results.weather.days) && results.weather.days.length > 0 && (
                        <div>
                          <div className="text-xs uppercase tracking-widest font-medium mb-3 flex items-center justify-between" style={{ color: 'var(--text-mute)' }}>
                            <span>Daily forecast</span>
                            <span className="normal-case tracking-normal" style={{ color: 'var(--text-mute)' }}>
                              All temperatures in {tempUnit}
                            </span>
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-2 scroll-x">
                            {results.weather.days.map((d, i) => (
                              <div key={i}
                                className="flex-shrink-0 surface-elevated rounded-xl p-4 text-center w-24 transition-all hover:-translate-y-1 animate-fade-in-up"
                                style={{ animationDelay: `${0.6 + i * 0.04}s` }}>
                                <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-mute)' }}>{d.date?.slice(5)}</div>
                                <div className="text-2xl mb-1.5 opacity-90">{d.icon || '☀️'}</div>
                                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                                  {d.high}{tempUnit}
                                  <span className="ml-1" style={{ color: 'var(--text-mute)' }}> / {d.low}{tempUnit}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Itinerary planner */}
            <ItineraryPlanner itinerary={results.itinerary} tempUnit={tempUnit} />

            {/* New search */}
            <div className="text-center pt-4 pb-12 animate-fade-in" style={{ animationDelay: '0.7s' }}>
              <button onClick={resetForm} className="btn-secondary font-medium py-3 px-8 rounded-lg text-sm tracking-wide">
                Plan another trip
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-center pt-8 pb-4 text-xs" style={{ color: 'var(--text-mute)' }}>
        <div className="divider mb-6 max-w-md mx-auto"></div>
        Crafted for explorers · Powered by AI
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<TravelPlanner />);
