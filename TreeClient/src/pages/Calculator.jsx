import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';


import { 
  Calculator as CalcIcon, 
  TreePine, 
  Leaf, 
  TrendingUp, 
  Sparkles,
  DollarSign,
  Car,
  Lightbulb,
  Save,
  RefreshCw,
  Globe,
  Wind,
  Droplets,
  Sun
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

// Enhanced species data with carbon absorption rates (kg CO₂ per year)
const speciesData = {
  Oak: { baseRate: 21, tip: "Oak trees are excellent for urban environments and provide great shade." },
  Pine: { baseRate: 18, tip: "Pine trees grow fast and are perfect for carbon sequestration projects." },
  Maple: { baseRate: 24, tip: "Maple trees have beautiful foliage and absorb CO₂ efficiently." },
  Birch: { baseRate: 19, tip: "Birch trees are hardy and adapt well to various climates." },
  Willow: { baseRate: 16, tip: "Willow trees love water and help prevent soil erosion." },
  Cedar: { baseRate: 22, tip: "Cedar trees are long-living and provide consistent carbon absorption." },
  Spruce: { baseRate: 20, tip: "Spruce trees are evergreen champions in cold climates." },
  Bamboo: { baseRate: 35, tip: "Bamboo is the fastest-growing plant and absorbs 35% more CO₂ than trees!" },
  Neem: { baseRate: 22, tip: "Neem trees are highly efficient in air purification and have medicinal properties." },
  Mango: { baseRate: 30, tip: "Mango trees not only absorb CO₂ but also provide delicious fruits!" },
  Peepal: { baseRate: 28, tip: "Peepal trees release oxygen 24/7 and are considered sacred in India." },
  Banyan: { baseRate: 32, tip: "Banyan trees can cover acres of land and support entire ecosystems." },
  Teak: { baseRate: 25, tip: "Teak is valuable timber and stores carbon for centuries in furniture." },
  Eucalyptus: { baseRate: 26, tip: "Eucalyptus grows rapidly and is excellent for reforestation projects." },
  Gulmohar: { baseRate: 20, tip: "Gulmohar's vibrant flowers make streets beautiful while cleaning air." },
  Jamun: { baseRate: 23, tip: "Jamun trees provide nutritious fruits and absorb significant CO₂." },
};

// Climate factors
const climateData = {
  humid: { factor: 1.2, icon: Droplets, color: "blue", label: "Humid/Tropical" },
  normal: { factor: 1.0, icon: Wind, color: "green", label: "Normal/Temperate" },
  dry: { factor: 0.8, icon: Sun, color: "orange", label: "Dry/Arid" },
};

// Carbon credit market value (₹ per credit)
const CREDIT_VALUE_INR = 700;
const KG_PER_CREDIT = 1000;

export default function Calculator() {
  const [formData, setFormData] = useState({
    species: '',
    age: '',
    climate: '',
  });
  
  const [result, setResult] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [savedResults, setSavedResults] = useState([]);

  // Load saved results from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('carbonCalculations');
    if (saved) {
      setSavedResults(JSON.parse(saved));
    }
  }, []);

  const calculateCredits = () => {
    const species = speciesData[formData.species];
    const climate = climateData[formData.climate];
    const age = parseInt(formData.age);

    if (!species || !climate || !age) return;

    // Main calculation
    const annualAbsorption = species.baseRate * climate.factor;
    const totalAbsorption = annualAbsorption * age;
    const carbonCredits = totalAbsorption / KG_PER_CREDIT;
    const marketValue = carbonCredits * CREDIT_VALUE_INR;
    
    // Calculate equivalents
    const carDays = Math.round(totalAbsorption / 16); // Average car emits 16kg CO₂ per day
    const lightbulbDays = Math.round(totalAbsorption / 0.4); // 0.4kg CO₂ per day for lightbulb
    const treesEquivalent = Math.round(totalAbsorption / 21); // Average tree absorbs 21kg/year
    
    // Progress towards 1 credit goal
    const progressToCredit = Math.min((carbonCredits / 1) * 100, 100);

    setResult({
      annualAbsorption: annualAbsorption.toFixed(2),
      totalAbsorption: totalAbsorption.toFixed(2),
      carbonCredits: carbonCredits.toFixed(3),
      marketValue: marketValue.toFixed(2),
      carDays,
      lightbulbDays,
      treesEquivalent,
      progressToCredit,
      tip: species.tip,
    });
  };

  const saveResult = () => {
    if (!result) return;
    
    const newResult = {
      id: Date.now(),
      species: formData.species,
      age: formData.age,
      climate: formData.climate,
      credits: result.carbonCredits,
      value: result.marketValue,
      date: new Date().toISOString(),
    };
    
    const updated = [newResult, ...savedResults.slice(0, 4)]; // Keep last 5
    setSavedResults(updated);
    localStorage.setItem('carbonCalculations', JSON.stringify(updated));
  };

  const resetCalculator = () => {
    setFormData({ species: '', age: '', climate: '' });
    setResult(null);
    setShowComparison(false);
  };

  // Generate comparison data
  const getComparisonData = () => {
    if (!formData.age || !formData.climate) return [];
    
    const climate = climateData[formData.climate];
    const age = parseInt(formData.age);
    
    return Object.entries(speciesData)
      .map(([name, data]) => ({
        name,
        absorption: (data.baseRate * climate.factor * age).toFixed(0),
        credits: ((data.baseRate * climate.factor * age) / KG_PER_CREDIT).toFixed(3),
      }))
      .sort((a, b) => b.absorption - a.absorption)
      .slice(0, 5);
  };

  const ClimateIcon = formData.climate ? climateData[formData.climate].icon : Wind;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl mb-4 shadow-2xl">
            <CalcIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-3">Carbon Credit Calculator</h1>
          <p className="text-xl text-gray-600">
            Calculate your tree's environmental impact and carbon credits value
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Calculator Form - 2 columns */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 space-y-6"
          >
            <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <TreePine className="w-6 h-6 text-green-600" />
                Tree Information
              </h2>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="species" className="text-gray-700 font-medium flex items-center gap-2 mb-2">
                    <Leaf className="w-4 h-4 text-green-600" />
                    Tree Species *
                  </Label>
                  <Select 
                    value={formData.species} 
                    onValueChange={(val) => setFormData({ ...formData, species: val })}
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue placeholder="Select tree species" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">
                        INDIAN SPECIES
                      </div>
                      {['Neem', 'Mango', 'Peepal', 'Banyan', 'Teak', 'Eucalyptus', 'Gulmohar', 'Jamun'].map(species => (
                        <SelectItem key={species} value={species}>
                          <div className="flex items-center justify-between w-full">
                            <span>{species}</span>
                            <span className="text-xs text-gray-500 ml-4">
                              {speciesData[species].baseRate} kg/year
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 border-t mt-1">
                        GLOBAL SPECIES
                      </div>
                      {['Oak', 'Pine', 'Maple', 'Birch', 'Willow', 'Cedar', 'Spruce', 'Bamboo'].map(species => (
                        <SelectItem key={species} value={species}>
                          <div className="flex items-center justify-between w-full">
                            <span>{species}</span>
                            <span className="text-xs text-gray-500 ml-4">
                              {speciesData[species].baseRate} kg/year
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="age" className="text-gray-700 font-medium flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    Tree Age (years) *
                  </Label>
                  <Input
                    id="age"
                    type="number"
                    min="1"
                    max="100"
                    placeholder="Enter tree age"
                    className="h-12 text-lg"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    Older trees absorb more carbon over their lifetime
                  </p>
                </div>

                <div>
                  <Label htmlFor="climate" className="text-gray-700 font-medium flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-purple-600" />
                    Climate Zone *
                  </Label>
                  <Select 
                    value={formData.climate} 
                    onValueChange={(val) => setFormData({ ...formData, climate: val })}
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue placeholder="Select climate zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(climateData).map(([key, data]) => {
                        const Icon = data.icon;
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 text-${data.color}-600`} />
                              <span>{data.label}</span>
                              <span className="text-xs text-gray-500">
                                ({data.factor}x factor)
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={calculateCredits}
                    disabled={!formData.species || !formData.age || !formData.climate}
                    className="flex-1 h-14 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg text-lg"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Calculate Impact
                  </Button>
                  
                  <Button
                    onClick={resetCalculator}
                    variant="outline"
                    className="h-14 px-4"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Saved Results */}
            {savedResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200"
              >
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Save className="w-5 h-5 text-purple-600" />
                  Recent Calculations
                </h3>
                <div className="space-y-2">
                  {savedResults.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{item.species} • {item.age}y</div>
                        <div className="text-xs text-gray-500">{item.climate}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">{item.credits} credits</div>
                        <div className="text-xs text-gray-500">₹{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Results - 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            <AnimatePresence mode="wait">
              {result ? (
                <>
                  {/* Main Results Card */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 rounded-3xl shadow-2xl p-8 text-white"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-3xl font-bold flex items-center gap-3">
                        <TrendingUp className="w-8 h-8" />
                        Carbon Impact Results
                      </h3>
                      <Button
                        onClick={saveResult}
                        className="bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Result
                      </Button>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                        <div className="text-sm opacity-90 mb-2">Annual Absorption</div>
                        <div className="text-4xl font-bold">{result.annualAbsorption}</div>
                        <div className="text-sm opacity-80 mt-1">kg CO₂/year</div>
                      </div>

                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                        <div className="text-sm opacity-90 mb-2">Total CO₂ Offset</div>
                        <div className="text-4xl font-bold">{result.totalAbsorption}</div>
                        <div className="text-sm opacity-80 mt-1">kg ({(result.totalAbsorption / 1000).toFixed(2)} tons)</div>
                      </div>

                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                        <div className="text-sm opacity-90 mb-2">Carbon Credits</div>
                        <div className="text-4xl font-bold">{result.carbonCredits}</div>
                        <div className="text-sm opacity-80 mt-1">credits earned</div>
                      </div>
                    </div>

                    {/* Progress to 1 Credit */}
                    <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold">Progress to 1 Credit Goal</span>
                        <span className="font-bold">{result.progressToCredit.toFixed(1)}%</span>
                      </div>
                      <Progress value={result.progressToCredit} className="h-3 bg-white/20" />
                      <div className="text-sm opacity-80 mt-2">
                        {result.progressToCredit >= 100 
                          ? "🎉 Goal achieved! Your tree has offset 1+ tons of CO₂!" 
                          : `${(1000 - result.totalAbsorption).toFixed(0)} kg more to reach 1 credit`}
                      </div>
                    </div>
                  </motion.div>

                  {/* Market Value & Impact Cards */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                          <DollarSign className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">Market Value</h4>
                          <p className="text-sm text-gray-600">Estimated worth</p>
                        </div>
                      </div>
                      <div className="text-4xl font-bold text-gray-900 mb-2">
                        ₹{result.marketValue}
                      </div>
                      <div className="text-sm text-gray-600">
                        @ ₹{CREDIT_VALUE_INR} per carbon credit
                      </div>
                      <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                        <p className="text-xs text-orange-800">
                          💡 Carbon credit prices vary by market. This is an estimated value based on current rates.
                        </p>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center">
                          <Car className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">Real-World Impact</h4>
                          <p className="text-sm text-gray-600">Equivalent to</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Car className="w-5 h-5 text-blue-600" />
                            <span className="text-sm font-medium">Car not driven for</span>
                          </div>
                          <span className="font-bold text-blue-600">{result.carDays} days</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-medium">Lightbulb powered</span>
                          </div>
                          <span className="font-bold text-green-600">{result.lightbulbDays} days</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <TreePine className="w-5 h-5 text-emerald-600" />
                            <span className="text-sm font-medium">Equivalent to</span>
                          </div>
                          <span className="font-bold text-emerald-600">{result.treesEquivalent} trees</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Educational Tip */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-xl p-6 text-white"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg mb-2">💡 Did You Know?</h4>
                        <p className="text-white/90 leading-relaxed">{result.tip}</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Species Comparison */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="font-bold text-gray-900 text-xl flex items-center gap-2">
                        <TreePine className="w-6 h-6 text-green-600" />
                        Compare with Other Species
                      </h4>
                      <Button
                        onClick={() => setShowComparison(!showComparison)}
                        variant="outline"
                        size="sm"
                      >
                        {showComparison ? 'Hide' : 'Show'} Comparison
                      </Button>
                    </div>

                    <AnimatePresence>
                      {showComparison && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-3"
                        >
                          <p className="text-sm text-gray-600 mb-4">
                            Top 5 species for {formData.age} years in {climateData[formData.climate].label} climate:
                          </p>
                          
                          {getComparisonData().map((item, index) => {
                            const isSelected = item.name === formData.species;
                            return (
                              <div
                                key={item.name}
                                className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                                  isSelected 
                                    ? 'bg-green-100 border-2 border-green-500' 
                                    : 'bg-gray-50 hover:bg-gray-100'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                                    index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                    index === 1 ? 'bg-gray-300 text-gray-700' :
                                    index === 2 ? 'bg-orange-400 text-orange-900' :
                                    'bg-gray-200 text-gray-600'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-900">
                                      {item.name}
                                      {isSelected && <span className="ml-2 text-xs text-green-600">✓ Your Selection</span>}
                                    </div>
                                    <div className="text-sm text-gray-600">{item.credits} credits</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-gray-900">{item.absorption} kg</div>
                                  <div className="text-xs text-gray-500">total CO₂</div>
                                </div>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-3xl shadow-2xl p-16 text-center border border-gray-200"
                >
                  <div className="w-32 h-32 bg-gradient-to-br from-green-100 to-emerald-200 rounded-full flex items-center justify-center mx-auto mb-8">
                    <CalcIcon className="w-16 h-16 text-green-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">Ready to Calculate?</h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Fill in your tree details on the left to discover its environmental impact
                  </p>
                  <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <TreePine className="w-8 h-8 text-green-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">Choose Species</p>
                    </div>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <TrendingUp className="w-8 h-8 text-blue-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">Enter Age</p>
                    </div>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Globe className="w-8 h-8 text-purple-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">Select Climate</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Progress value={65} />
          </div>
        </div>
      </div>
    </div>
  );
}