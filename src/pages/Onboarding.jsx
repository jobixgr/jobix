
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { createPageUrl } from '@/utils';
import { Organization, User } from '@/api/entities';
import { Loader2, CheckCircle, Building2, User as UserIcon, Wrench } from 'lucide-react';

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  
  const [formData, setFormData] = useState({
    // Company Info
    companyName: '',
    companyPhone: '',
    companyEmail: '',
    companyAddress: '',
    
    // Personal Info
    phone: '',
    position: 'Ιδιοκτήτης'
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        
        // If user already has an organization, redirect to dashboard
        if (currentUser.organization_id) {
          navigate(createPageUrl('Dashboard'));
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = () => {
    if (currentStep === 1 && !formData.companyName) {
      setError('Παρακαλώ συμπληρώστε το όνομα της εταιρείας');
      return;
    }
    setError('');
    setCurrentStep(prev => prev + 1);
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError('');

    try {
      if (!formData.companyName) {
        throw new Error('Το όνομα της εταιρείας είναι υποχρεωτικό');
      }

      // Create organization with trial data
      const organization = await Organization.create({
        name: formData.companyName,
        phone: formData.companyPhone,
        email: formData.companyEmail,
        address: formData.companyAddress,
        vat_rate: 24,
        currency: 'EUR',
        trial_started_at: new Date().toISOString(),
        subscription_status: 'trialing'
      });

      // Update user with organization and other details, but NOT the role
      await User.updateMyUserData({
        organization_id: organization.id,
        phone: formData.phone,
        position: formData.position
      });

      // Redirect to dashboard
      navigate(createPageUrl('Dashboard'));

    } catch (err) {
      console.error('Onboarding error:', err);
      setError(err.message || 'Παρουσιάστηκε σφάλμα κατά τη ρύθμιση');
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitles = {
    1: 'Στοιχεία Εταιρείας',
    2: 'Προσωπικά Στοιχεία',
    3: 'Ολοκλήρωση'
  };

  const stepIcons = {
    1: Building2,
    2: UserIcon,
    3: CheckCircle
  };

  const getCurrentIcon = () => {
    const IconComponent = stepIcons[currentStep];
    return <IconComponent className="w-8 h-8 text-blue-600" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Header */}
        <div className="text-center mb-8">
          <div className="gradient-bg w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">J</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Καλώς ήρθατε!</h1>
          <p className="text-slate-600 mb-6">Ας ρυθμίσουμε την εταιρεία σας σε 3 απλά βήματα</p>
          
          <div className="mb-4">
            <Progress value={(currentStep / 3) * 100} className="w-full" />
          </div>
          <p className="text-sm text-slate-500">Βήμα {currentStep} από 3</p>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              {getCurrentIcon()}
            </div>
            <CardTitle className="text-2xl">{stepTitles[currentStep]}</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {error && (
              <Alert className="mb-6 border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            {/* Step 1: Company Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Όνομα Εταιρείας *</Label>
                  <Input
                    id="companyName"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    placeholder="π.χ. Κατασκευές Παπαδόπουλος"
                    className="text-lg"
                    required
                  />
                  <p className="text-sm text-slate-500 mt-1">
                    Αυτό θα εμφανίζεται στις προσφορές και τα τιμολόγιά σας
                  </p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyPhone">Τηλέφωνο</Label>
                    <Input
                      id="companyPhone"
                      name="companyPhone"
                      value={formData.companyPhone}
                      onChange={handleChange}
                      placeholder="π.χ. 210 1234567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="companyEmail">Email Εταιρείας</Label>
                    <Input
                      id="companyEmail"
                      name="companyEmail"
                      type="email"
                      value={formData.companyEmail}
                      onChange={handleChange}
                      placeholder="π.χ. info@example.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="companyAddress">Διεύθυνση</Label>
                  <Input
                    id="companyAddress"
                    name="companyAddress"
                    value={formData.companyAddress}
                    onChange={handleChange}
                    placeholder="π.χ. Λεωφ. Συγγρού 123, Αθήνα"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Personal Info */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <p className="text-slate-600">
                    Γεια σας <strong>{user?.full_name}</strong>! Ας συμπληρώσουμε τα προσωπικά σας στοιχεία.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Προσωπικό Τηλέφωνο</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="π.χ. 697 1234567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="position">Θέση στην Εταιρεία</Label>
                    <Input
                      id="position"
                      name="position"
                      value={formData.position}
                      onChange={handleChange}
                      placeholder="π.χ. Ιδιοκτήτης, Μάστορας"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Completion */}
            {currentStep === 3 && (
              <div className="text-center space-y-6">
                <div>
                  <Wrench className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    Σχεδόν έτοιμοι!
                  </h3>
                  <p className="text-slate-600">
                    Επιβεβαιώστε τα στοιχεία σας και ξεκινήστε να χρησιμοποιείτε 
                    το Jobix με 30 ημέρες δωρεάν δοκιμής!
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg text-left">
                  <h4 className="font-semibold mb-2">Εταιρεία:</h4>
                  <p className="text-slate-700">{formData.companyName}</p>
                  {formData.companyPhone && <p className="text-slate-600 text-sm">{formData.companyPhone}</p>}
                  {formData.companyEmail && <p className="text-slate-600 text-sm">{formData.companyEmail}</p>}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              {currentStep > 1 && (
                <Button variant="outline" onClick={() => setCurrentStep(prev => prev - 1)}>
                  Προηγούμενο
                </Button>
              )}
              
              <div className="ml-auto">
                {currentStep < 3 ? (
                  <Button onClick={handleNext} className="gradient-bg text-white px-8">
                    Επόμενο
                  </Button>
                ) : (
                  <Button 
                    onClick={handleComplete} 
                    className="gradient-bg text-white px-8"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Ολοκλήρωση...
                      </>
                    ) : (
                      'Ξεκινήστε!'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
