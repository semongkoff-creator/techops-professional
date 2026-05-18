# Flutter / WebView hardening rules
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

-keep class androidx.webkit.** { *; }
-keep class android.webkit.** { *; }
-dontwarn org.chromium.**

-keepattributes *Annotation*
-keepattributes Signature
-keepattributes EnclosingMethod
-keepattributes InnerClasses
