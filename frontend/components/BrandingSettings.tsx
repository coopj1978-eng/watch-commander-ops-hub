import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "~backend/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Palette } from "lucide-react";

export function BrandingSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [logoUrl, setLogoUrl] = useState<string>("");
  const [primaryColor, setPrimaryColor] = useState<string>("");
  const [secondaryColor, setSecondaryColor] = useState<string>("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => backend.settings.get(),
  });

  useEffect(() => {
    if (settings) {
      setLogoUrl(settings.branding_logo_url || "");
      setPrimaryColor(settings.branding_primary_color || "");
      setSecondaryColor(settings.branding_secondary_color || "");
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      return await backend.settings.updateBranding({
        branding_logo_url: logoUrl || undefined,
        branding_primary_color: primaryColor || undefined,
        branding_secondary_color: secondaryColor || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Branding updated",
        description: "Branding settings have been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (error: any) => {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update branding",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate();
  };

  const hasChanges = settings && (
    logoUrl !== (settings.branding_logo_url || "") ||
    primaryColor !== (settings.branding_primary_color || "") ||
    secondaryColor !== (settings.branding_secondary_color || "")
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Branding Configuration
        </CardTitle>
        <CardDescription>
          Customize the application logo and color scheme
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="logo-url">Logo URL</Label>
          <Input
            id="logo-url"
            type="url"
            placeholder="https://example.com/logo.png"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            URL to your organization's logo image
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary-color">Primary Color</Label>
            <div className="flex gap-2">
              <Input
                id="primary-color"
                type="text"
                placeholder="#4F46E5"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1"
              />
              <Input
                type="color"
                value={primaryColor || "#4F46E5"}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-14 h-10 p-1 cursor-pointer"
                aria-label="Choose primary color"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Main brand color (hex format)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondary-color">Secondary Color</Label>
            <div className="flex gap-2">
              <Input
                id="secondary-color"
                type="text"
                placeholder="#9333EA"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1"
              />
              <Input
                type="color"
                value={secondaryColor || "#9333EA"}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-14 h-10 p-1 cursor-pointer"
                aria-label="Choose secondary color"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Accent color (hex format)
            </p>
          </div>
        </div>

        {(primaryColor || secondaryColor) && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-3">Color Preview</p>
            <div className="flex gap-3">
              {primaryColor && (
                <div className="space-y-2">
                  <div
                    className="w-16 h-16 rounded-lg border-2 border-border"
                    style={{ backgroundColor: primaryColor }}
                    aria-label={`Primary color: ${primaryColor}`}
                  />
                  <p className="text-xs text-center text-muted-foreground">Primary</p>
                </div>
              )}
              {secondaryColor && (
                <div className="space-y-2">
                  <div
                    className="w-16 h-16 rounded-lg border-2 border-border"
                    style={{ backgroundColor: secondaryColor }}
                    aria-label={`Secondary color: ${secondaryColor}`}
                  />
                  <p className="text-xs text-center text-muted-foreground">Secondary</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (settings) {
                setLogoUrl(settings.branding_logo_url || "");
                setPrimaryColor(settings.branding_primary_color || "");
                setSecondaryColor(settings.branding_secondary_color || "");
              }
            }}
            disabled={!hasChanges || updateMutation.isPending}
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
