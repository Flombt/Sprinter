Pod::Spec.new do |s|
  s.name = 'SprinterApple'
  s.version = '1.0.0'
  s.summary = 'Sprinter HealthKit integration'
  s.description = 'Local optional HealthKit access, without a workout session or background execution request.'
  s.license = 'MIT'
  s.author = 'Sprinter'
  s.homepage = 'https://developer.apple.com/health-fitness/'
  # Local development pod: Expo autolinking supplies the path; it is not fetched from a remote repository.
  s.source = { :git => '' }
  s.platform = :ios, '16.4'
  s.swift_version = '5.9'
  s.static_framework = true
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit', 'ActivityKit', 'CoreMotion'
  s.source_files = '**/*.swift'
  s.resource_bundles = { 'SprinterApplePrivacy' => ['PrivacyInfo.xcprivacy'] }
end
