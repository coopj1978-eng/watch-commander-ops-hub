import { SignIn } from "@clerk/clerk-react";
import { useHasWC } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";
import { useState } from "react";
import { useBackend } from "@/lib/rbac";
import { useToast } from "@/components/ui/use-toast";

export default function SignInPage() {
  const { data: hasWC, isLoading } = useHasWC();
  const [setupToken, setSetupToken] = useState("");
  const [showBootstrap, setShowBootstrap] = useState(false);
  const client = useBackend();
  const { toast } = useToast();

  const handleBootstrap = async () => {
    if (!setupToken.trim()) {
      toast({
        title: "Setup token required",
        description: "Please enter the setup token provided by your administrator.",
        variant: "destructive",
      });
      return;
    }

    try {
      await client.admin.bootstrap({ setupToken });
      toast({
        title: "Success!",
        description: "You have been promoted to Watch Commander. Please refresh the page.",
      });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      toast({
        title: "Bootstrap failed",
        description: error instanceof Error ? error.message : "Failed to bootstrap account",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-600 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl">Watch Commander Operations Hub</CardTitle>
            <CardDescription>Sign in to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none",
                },
              }}
            />
          </CardContent>
        </Card>

        {!isLoading && hasWC === false && (
          <Alert className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
            <Shield className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-900 dark:text-orange-100">
              <div className="space-y-2">
                <p className="font-medium">No Watch Commander assigned</p>
                <p className="text-sm">
                  If you're the first user, you can promote yourself to Watch Commander using the
                  setup token.
                </p>
                {!showBootstrap ? (
                  <Button
                    onClick={() => setShowBootstrap(true)}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    Become Watch Commander
                  </Button>
                ) : (
                  <div className="space-y-2 mt-2">
                    <input
                      type="password"
                      placeholder="Enter setup token"
                      value={setupToken}
                      onChange={(e) => setSetupToken(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleBootstrap} size="sm" className="flex-1">
                        Bootstrap Account
                      </Button>
                      <Button
                        onClick={() => {
                          setShowBootstrap(false);
                          setSetupToken("");
                        }}
                        variant="ghost"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
