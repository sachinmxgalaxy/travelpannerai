import React, { useState } from 'react';
import { MapPin, Calendar, Cloud, Hotel, Compass, Sparkles, Sun, CloudRain, CloudSnow, Wind, Star, ArrowRight, Loader2, AlertCircle, Coffee, Camera, Utensils } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TravelPlanner() {
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const generateMockData = (loc) => {
    const cityName = loc.trim();
    return {
      city: cityName,
      overview: {
        intro: `${cityName} is a vibrant destination known for its rich culture, friendly locals, and unforgettable experiences. Whether you're a foodie, history lover, or adventure seeker, there's something here for everyone.`,
        tips: [
          { icon: 'coffee', title: 'Local Etiquette', text: 'Greet locals with a smile. Tipping customs vary, so check before dining out.' },
          { icon: 'camera', title: 'Must-Know', text: 'Carry some local currency for small vendors and street food stalls.' },
          { icon: 'utensils', title: 'Food Scene', text: 'Try the regional specialties at family-run spots away from main tourist areas.' },
          { icon: 'compass', title: 'Getting Around', text: 'Public transport is efficient and affordable. Walking is often the best way to explore.' },
        ],
        safety: 'Generally safe for travelers. Stay aware of your surroundings in crowded areas and keep valuables secure.',
      },
      places: [
        { name: 'Historic Old Town', type: 'Cultural', rating: 4.8, desc: 'Wander through cobblestone streets lined with centuries-old architecture and charming cafés.', time: '3-4 hours' },
        { name: 'Central Park & Gardens', type: 'Nature', rating: 4.7, desc: 'A peaceful escape with walking trails, seasonal flowers, and scenic viewpoints.', time: '2 hours' },
        { name: 'Grand Museum', type: 'Museum', rating: 4.6, desc: 'Home to remarkable collections spanning art, history, and local heritage.', time: '2-3 hours' },
        { name: 'Riverside Promenade', type: 'Scenic', rating: 4.9, desc: 'Perfect for sunset strolls, with cafés and street performers along the way.', time: '1-2 hours' },
        { name: 'Local Market Square', type: 'Shopping', rating: 4.5, desc: 'Authentic local goods, artisan crafts, and incredible street food vendors.', time: '2 hours' },
        { name: 'Sunset Viewpoint', type: 'Scenic', rating: 4.9, desc: 'The best panoramic view of the city, especially magical at golden hour.', time: '1 hour' },
      ],
      hotels: [
        { name: 'The Grand Plaza', stars: 5, price: '$280', desc: 'Luxury rooms with city views, rooftop pool, and award-winning spa.', perks: ['Pool', 'Spa', 'Breakfast'] },
        { name: 'Boutique Heritage Inn', stars: 4, price: '$145', desc: 'Charming character hotel in the historic district, walking distance to attractions.', perks: ['Wi-Fi', 'Bar', 'Concierge'] },
        { name: 'Modern City Suites', stars: 4, price: '$120', desc: 'Stylish apartments with kitchenettes, ideal for longer stays.', perks: ['Kitchen', 'Gym', 'Wi-Fi'] },
        { name: 'Cozy Traveler Hostel', stars: 3, price: '$45', desc: 'Budget-friendly with private and shared rooms, great for meeting other travelers.', perks: ['Wi-Fi', 'Lounge', 'Tours'] },
      ],
      weather: {
        avg: 22,
        condition: 'Mostly Sunny',
        forecast: [
          { day: 'Mon', temp: 23, cond: 'sun' },
          { day: 'Tue', temp: 21, cond: 'cloud' },
          { day: 'Wed', temp: 19, cond: 'rain' },
          { day: 'Thu', temp: 22, cond: 'sun' },
          { day: 'Fri', temp: 24, cond: 'sun' },
          { day: 'Sat', temp: 25, cond: 'sun' },
          { day: 'Sun', temp: 22, cond: 'cloud' },
        ],
        advice: 'Pack light layers, comfortable walking shoes, sunglasses, and a light rain jacket just in case.',
      },
    };
  };

  const handleSearch = () => {
    if (!location || !startDate || !endDate) return;
    setLoading(true);
    setResults(null);
    setTimeout(() => {
      setResults(generateMockData(location));
      setLoading(false);
      setActiveTab('overview');
    }, 1400);
  };

  const handleReset = () => {
    setResults(null);
    setLocation('');
    setStartDate('');
    setEndDate('');
  };

  const getWeatherIcon = (cond, size = 'w-6 h-6') => {
    switch (cond) {
      case 'sun': return <Sun className={`${size} text-amber-400`} />;
      case 'cloud': return <Cloud className={`${size} text-slate-400`} />;
      case 'rain': return <CloudRain className={`${size} text-blue-400`} />;
      case 'snow': return <CloudSnow className={`${size} text-sky-300`} />;
      default: return <Sun className={`${size} text-amber-400`} />;
    }
  };

  const getTipIcon = (type) => {
    const cls = "w-5 h-5 text-indigo-500";
    switch (type) {
      case 'coffee': return <Coffee className={cls} />;
      case 'camera': return <Camera className={cls} />;
      case 'utensils': return <Utensils className={cls} />;
      case 'compass': return <Compass className={cls} />;
      default: return <Sparkles className={cls} />;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Compass },
    { id: 'places', label: 'Places', icon: MapPin },
    { id: 'hotels', label: 'Hotels', icon: Hotel },
    { id: 'weather', label: 'Weather', icon: Cloud },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1 bg-white rounded-full shadow-sm mb-4">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-medium text-slate-600">AI Travel Planner</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-800 mb-3 tracking-tight">
            Where to next?
          </h1>
          <p className="text-slate-500 max-w-md mx-auto">
            Plan your perfect trip in seconds. Tell us where and when, we'll handle the rest.
          </p>
        </motion.div>

        {/* Search Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl shadow-xl shadow-indigo-100 p-6 sm:p-8 mb-8 border border-slate-100"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="md:col-span-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Destination
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Tokyo, Paris, Rome..."
                  className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition text-slate-700 placeholder-slate-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Check-in
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition text-slate-700"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Check-out
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition text-slate-700"
                />
              </div>
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !location || !startDate || !endDate}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Planning your trip...
              </>
            ) : (
              <>
                Plan My Trip
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </motion.div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {results && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* City Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">{results.city}</h2>
                  <p className="text-slate-500 text-sm mt-1">Your personalized travel guide</p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  ← New search
                </button>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 flex gap-1 overflow-x-auto">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 min-w-max flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                        active
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* OVERVIEW */}
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-indigo-500" />
                          About {results.city}
                        </h3>
                        <p className="text-slate-600 leading-relaxed">{results.overview.intro}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {results.overview.tips.map((tip, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition"
                          >
                            <div className="flex items-start gap-3">
                              <div className="bg-indigo-50 p-2 rounded-lg">
                                {getTipIcon(tip.icon)}
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-800 mb-1">{tip.title}</h4>
                                <p className="text-sm text-slate-600 leading-relaxed">{tip.text}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-amber-900 mb-1">Safety Tip</h4>
                          <p className="text-sm text-amber-800 leading-relaxed">{results.overview.safety}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PLACES */}
                  {activeTab === 'places' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {results.places.map((place, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                              {place.type}
                            </span>
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                              <span className="text-sm font-semibold text-slate-700">{place.rating}</span>
                            </div>
                          </div>
                          <h4 className="font-bold text-slate-800 text-lg mb-2">{place.name}</h4>
                          <p className="text-sm text-slate-600 leading-relaxed mb-3">{place.desc}</p>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Recommended: {place.time}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* HOTELS */}
                  {activeTab === 'hotels' && (
                    <div className="space-y-4">
                      {results.hotels.map((hotel, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-slate-800 text-lg">{hotel.name}</h4>
                                <div className="flex">
                                  {Array.from({ length: hotel.stars }).map((_, idx) => (
                                    <Star key={idx} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                  ))}
                                </div>
                              </div>
                              <p className="text-sm text-slate-600 mb-3">{hotel.desc}</p>
                              <div className="flex flex-wrap gap-2">
                                {hotel.perks.map((perk, idx) => (
                                  <span key={idx} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                                    {perk}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right sm:border-l sm:border-slate-100 sm:pl-5">
                              <div className="text-2xl font-bold text-slate-800">{hotel.price}</div>
                              <div className="text-xs text-slate-500">per night</div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* WEATHER */}
                  {activeTab === 'weather' && (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-500 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div>
                            <p className="text-blue-100 text-sm mb-1">Average during your stay</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-5xl font-bold">{results.weather.avg}°</span>
                              <span className="text-blue-100">C</span>
                            </div>
                            <p className="text-blue-50 mt-1">{results.weather.condition}</p>
                          </div>
                          <Sun className="w-20 h-20 text-amber-200" />
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-100 p-5">
                        <h4 className="font-semibold text-slate-800 mb-4">7-Day Forecast</h4>
                        <div className="grid grid-cols-7 gap-2">
                          {results.weather.forecast.map((day, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="text-center p-2 rounded-xl hover:bg-slate-50 transition"
                            >
                              <div className="text-xs font-medium text-slate-500 mb-2">{day.day}</div>
                              <div className="flex justify-center mb-2">
                                {getWeatherIcon(day.cond, 'w-7 h-7')}
                              </div>
                              <div className="text-sm font-semibold text-slate-700">{day.temp}°</div>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex gap-3">
                        <Wind className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-indigo-900 mb-1">Packing Advice</h4>
                          <p className="text-sm text-indigo-800 leading-relaxed">{results.weather.advice}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!results && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center py-12"
          >
            <div className="inline-flex p-4 bg-white rounded-2xl shadow-sm mb-4">
              <Compass className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-slate-500 text-sm">Enter a destination above to start planning</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
