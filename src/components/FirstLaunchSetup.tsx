import React, { useState, useEffect } from 'react';
import { Shield, Monitor, Mic, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

interface PermissionStatus {
  microphone: 'granted' | 'denied' | 'not-determined' | 'unknown';
  screenCapture: 'granted' | 'denied' | 'not-determined' | 'unknown';
}

interface FirstLaunchSetupProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const FirstLaunchSetup: React.FC<FirstLaunchSetupProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState<'welcome' | 'permissions' | 'testing' | 'complete'>('welcome');
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    microphone: 'unknown',
    screenCapture: 'unknown'
  });
  const [loading, setLoading] = useState(false);
  const [testingSystemAudio, setTestingSystemAudio] = useState(false);
  const [systemAudioWorking, setSystemAudioWorking] = useState<boolean | null>(null);

  const [permissionDiagnostics, setPermissionDiagnostics] = useState<any>(null);
  const [fixingPermissions, setFixingPermissions] = useState(false);

  useEffect(() => {
    checkPermissions();
    getPermissionDiagnostics();
  }, []);

  const getPermissionDiagnostics = async () => {
    try {
      const result = await window.electronAPI.invoke('permission-get-diagnostics');
      if (result.success) {
        setPermissionDiagnostics(result.diagnostics);
      }
    } catch (error) {
      console.error('Failed to get permission diagnostics:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      // Use the working IPC invoke method directly
      const status = await window.electronAPI.invoke('permission-check-status');
      setPermissionStatus(status);
    } catch (error) {
      console.error('Failed to check permissions:', error);
    }
  };

  const requestMicrophonePermission = async () => {
    setLoading(true);
    try {
      await window.electronAPI.invoke('permission-request-microphone');
      await checkPermissions();
    } catch (error) {
      console.error('Failed to request microphone permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestSystemAudioPermission = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.invoke('permission-request-system-audio');
      if (result.granted) {
        await checkPermissions();
      } else {
        // System Preferences opened automatically
        console.log('System Preferences opened for manual permission grant');
      }
    } catch (error) {
      console.error('Failed to request system audio permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const testSystemAudio = async () => {
    setTestingSystemAudio(true);
    setSystemAudioWorking(null);
    
    try {
      // Try to get system audio sources
      const sourcesResult = await window.electronAPI.audioGetSources();
      if (sourcesResult.success) {
        const systemSources = sourcesResult.sources.filter(s => s.type === 'system' && s.available);
        setSystemAudioWorking(systemSources.length > 0);
      } else {
        setSystemAudioWorking(false);
      }
    } catch (error) {
      console.error('Failed to test system audio:', error);
      setSystemAudioWorking(false);
    } finally {
      setTestingSystemAudio(false);
    }
  };

  const attemptPermissionFix = async () => {
    setFixingPermissions(true);
    try {
      const result = await window.electronAPI.invoke('permission-attempt-fix');
      if (result.success) {
        console.log('Permission fix successful:', result);
        await checkPermissions();
        await getPermissionDiagnostics();
      } else {
        console.error('Permission fix failed:', result);
        alert(`Permission fix failed: ${result.message}

Next steps:
${result.nextActions.join('
')}`);
      }
    } catch (error) {
      console.error('Permission fix error:', error);
      alert('Permission fix failed. Please try manual troubleshooting.');
    } finally {
      setFixingPermissions(false);
    }
  };

  const openDiagnostics = async () => {
    try {
      // This will run the diagnostic script
      alert('Opening diagnostic tool...\n\nCheck your terminal for detailed permission analysis and fix recommendations.');
      await window.electronAPI.invoke('run-permission-diagnostics');
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
    }
  };

  const attemptPermissionFix = async () => {
    setFixingPermissions(true);
    try {
      const result = await window.electronAPI.invoke('permission-attempt-fix');
      if (result.success) {
        console.log('Permission fix successful:', result);
        await checkPermissions();
        await getPermissionDiagnostics();
      } else {
        console.error('Permission fix failed:', result);
        alert(`Permission fix failed: ${result.message}

Next steps:
${result.nextActions.join('
')}`);
      }
    } catch (error) {
      console.error('Permission fix error:', error);
      alert('Permission fix failed. Please try manual troubleshooting.');
    } finally {
      setFixingPermissions(false);
    }
  };

  const openDiagnostics = async () => {
    try {
      // This will run the diagnostic script
      alert('Opening diagnostic tool...\n\nCheck your terminal for detailed permission analysis and fix recommendations.');
      await window.electronAPI.invoke('run-permission-diagnostics');
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
    }
  };

  const getPermissionIcon = (status: string) => {
    switch (status) {
      case 'granted':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'denied':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Shield className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getPermissionText = (status: string) => {
    switch (status) {
      case 'granted': return 'Granted';
      case 'denied': return 'Denied';
      case 'not-determined': return 'Not requested';
      default: return 'Unknown';
    }
  };

  const renderWelcomeStep = () => (
    <div className="text-center space-y-6">
      <div className="space-y-4">
        <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
          <Shield className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome to CueMe!</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          Let's set up audio permissions so you can get the most out of CueMe's system audio capture features.
        </p>
      </div>
      
      <div className="bg-blue-50 rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-blue-900">What we'll set up:</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm text-blue-800">
            <Mic className="w-4 h-4" />
            <span>Microphone access for voice detection</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-blue-800">
            <Monitor className="w-4 h-4" />
            <span>System audio capture for Zoom meetings</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={() => setCurrentStep('permissions')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          Get Started
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onSkip}
          className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Skip Setup
        </button>
      </div>
    </div>
  );

  const renderPermissionsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Grant Permissions</h2>
        <p className="text-gray-600">
          We need these permissions for CueMe to work properly:
        </p>
      </div>

      <div className="space-y-4">
        {/* Microphone Permission */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Mic className="w-5 h-5 text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">Microphone</div>
                <div className="text-sm text-gray-600">Required for voice detection</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getPermissionIcon(permissionStatus.microphone)}
              <span className="text-sm text-gray-600">
                {getPermissionText(permissionStatus.microphone)}
              </span>
            </div>
          </div>
          
          {permissionStatus.microphone !== 'granted' && (
            <button
              onClick={requestMicrophonePermission}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                'Grant Microphone Permission'
              )}
            </button>
          )}
        </div>

        {/* System Audio Permission */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-purple-600" />
              <div>
                <div className="font-medium text-gray-900">Screen Recording</div>
                <div className="text-sm text-gray-600">Enables system audio capture</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getPermissionIcon(permissionStatus.screenCapture)}
              <span className="text-sm text-gray-600">
                {getPermissionText(permissionStatus.screenCapture)}
              </span>
            </div>
          </div>
          
          {permissionStatus.screenCapture !== 'granted' && (
            <div className="space-y-3">
              <button
                onClick={requestSystemAudioPermission}
                disabled={loading}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Grant Screen Recording Permission'
                )}
              </button>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-sm text-yellow-800">
                  <div className="font-medium mb-1">After clicking above:</div>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>System Settings will open</li>
                    <li>Find "CueMe" in the list</li>
                    <li>Enable the toggle next to it</li>
                    <li>Return to this window</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={() => setCurrentStep('testing')}
          disabled={permissionStatus.microphone !== 'granted'}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Continue to Testing
        </button>
        <button
          onClick={() => checkPermissions()}
          className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Refresh Status
        </button>
      </div>
    </div>
  );

  const renderTestingStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Test System Audio</h2>
        <p className="text-gray-600">
          Let's verify that system audio capture is working correctly:
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-purple-100 rounded-full flex items-center justify-center">
            <Monitor className="w-6 h-6 text-purple-600" />
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-1">System Audio Test</h3>
            <p className="text-sm text-gray-600">
              This will check if CueMe can access your system's audio output
            </p>
          </div>

          {systemAudioWorking === null ? (
            <button
              onClick={testSystemAudio}
              disabled={testingSystemAudio}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium"
            >
              {testingSystemAudio ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Testing...
                </>
              ) : (
                'Test System Audio'
              )}
            </button>
          ) : systemAudioWorking ? (
            <div className="text-center space-y-3">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
              <div>
                <div className="font-medium text-green-700">System Audio Working!</div>
                <div className="text-sm text-green-600">
                  CueMe can successfully capture system audio
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto" />
              <div>
                <div className="font-medium text-yellow-700">System Audio Limited</div>
                <div className="text-sm text-yellow-600">
                  Microphone will be used instead - this works great for most use cases
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={handleComplete}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Complete Setup
        </button>
        {systemAudioWorking === false && (
          <button
            onClick={() => setCurrentStep('permissions')}
            className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Back to Permissions
          </button>
        )}
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center space-y-6">
      <div className="space-y-4">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
        <h2 className="text-2xl font-bold text-gray-900">Setup Complete!</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          CueMe is ready to use. You can now capture audio and get real-time question suggestions.
        </p>
      </div>

      <div className="bg-green-50 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 mb-2">Quick Tips:</h3>
        <ul className="text-sm text-green-800 space-y-1 text-left max-w-md mx-auto">
          <li>• Use "System Audio" for Zoom meetings</li>
          <li>• Use "Microphone" for in-person conversations</li>
          <li>• Questions appear automatically as you speak</li>
          <li>• Check audio settings in the top-right menu</li>
        </ul>
      </div>

      <button
        onClick={handleComplete}
        className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Start Using CueMe
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          {currentStep === 'welcome' && renderWelcomeStep()}
          {currentStep === 'permissions' && renderPermissionsStep()}
          {currentStep === 'testing' && renderTestingStep()}
          {currentStep === 'complete' && renderCompleteStep()}
        </div>
      </div>
    </div>
  );
};