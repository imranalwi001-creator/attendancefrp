import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { ExtractionCardHeader } from '@/components/ui/extraction-card-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Save, X, Navigation, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLogger';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ensure Leaflet CSS is loaded globally
const leafletStyles = document.createElement('link');
leafletStyles.rel = 'stylesheet';
leafletStyles.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
leafletStyles.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
leafletStyles.crossOrigin = '';
if (!document.querySelector('link[href*="leaflet.css"]')) {
  document.head.appendChild(leafletStyles);
}
const lokasiSchema = z.object({
  nama: z.string().trim().min(1, 'Nama lokasi wajib diisi').max(100, 'Nama maksimal 100 karakter'),
  alamat: z.string().trim().max(500, 'Alamat maksimal 500 karakter').optional(),
  latitude: z.number({ invalid_type_error: 'Latitude harus berupa angka' }).min(-90).max(90),
  longitude: z.number({ invalid_type_error: 'Longitude harus berupa angka' }).min(-180).max(180),
  radius: z.number({ invalid_type_error: 'Radius harus berupa angka' }).min(10, 'Radius minimal 10 meter').max(10000, 'Radius maksimal 10000 meter'),
});

type LokasiFormData = z.infer<typeof lokasiSchema>;

interface LokasiAbsen {
  id: string;
  nama: string;
  alamat: string | null;
  latitude: number;
  longitude: number;
  radius: number;
}

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export function LokasiAbsenForm() {
  const queryClient = useQueryClient();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<LokasiFormData>({
    nama: '',
    alamat: '',
    latitude: 0,
    longitude: 0,
    radius: 100,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Fetch existing location
  const { data: lokasi, isLoading } = useQuery({
    queryKey: ['lokasi-absen'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lokasi_absen')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as LokasiAbsen | null;
    }
  });

  // Update form when data loads
  useEffect(() => {
    if (lokasi) {
      setFormData({
        nama: lokasi.nama,
        alamat: lokasi.alamat || '',
        latitude: Number(lokasi.latitude),
        longitude: Number(lokasi.longitude),
        radius: lokasi.radius,
      });
    }
  }, [lokasi]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!lokasi) {
      // If no existing data, check if any field has been filled
      return formData.nama !== '' || formData.alamat !== '' || 
             formData.latitude !== 0 || formData.longitude !== 0 || 
             formData.radius !== 100;
    }
    return (
      formData.nama !== lokasi.nama ||
      formData.alamat !== (lokasi.alamat || '') ||
      formData.latitude !== Number(lokasi.latitude) ||
      formData.longitude !== Number(lokasi.longitude) ||
      formData.radius !== lokasi.radius
    );
  }, [formData, lokasi]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const defaultLat = formData.latitude || -6.2088;
    const defaultLng = formData.longitude || 106.8456;

    const map = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], 16);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add marker
    const marker = L.marker([defaultLat, defaultLng], { draggable: false }).addTo(map);
    markerRef.current = marker;

    // Add radius circle
    const circle = L.circle([defaultLat, defaultLng], {
      radius: formData.radius,
      color: 'hsl(var(--primary))',
      fillColor: 'hsl(var(--primary))',
      fillOpacity: 0.2,
    }).addTo(map);
    circleRef.current = circle;

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Enable/disable map interactions based on edit mode
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;

    const map = mapRef.current;
    const marker = markerRef.current;
    const circle = circleRef.current;

    if (isEditing) {
      // Enable interactions
      marker.dragging?.enable();
      
      // Handle marker drag
      marker.off('dragend');
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setFormData(prev => ({
          ...prev,
          latitude: pos.lat,
          longitude: pos.lng,
        }));
        circle.setLatLng(pos);
      });

      // Handle map click
      map.off('click');
      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        setFormData(prev => ({
          ...prev,
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        }));
      });
    } else {
      // Disable interactions
      marker.dragging?.disable();
      map.off('click');
      marker.off('dragend');
    }
  }, [isEditing]);

  // Update marker and circle when formData changes
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;
    
    if (formData.latitude && formData.longitude) {
      const latlng = L.latLng(formData.latitude, formData.longitude);
      markerRef.current.setLatLng(latlng);
      circleRef.current.setLatLng(latlng);
      circleRef.current.setRadius(formData.radius);
      mapRef.current.setView(latlng);
    }
  }, [formData.latitude, formData.longitude, formData.radius]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: LokasiFormData) => {
      if (lokasi?.id) {
        // Update existing
        const { error } = await supabase
          .from('lokasi_absen')
          .update({
            nama: data.nama,
            alamat: data.alamat || null,
            latitude: data.latitude,
            longitude: data.longitude,
            radius: data.radius,
          })
          .eq('id', lokasi.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('lokasi_absen')
          .insert({
            nama: data.nama,
            alamat: data.alamat || null,
            latitude: data.latitude,
            longitude: data.longitude,
            radius: data.radius,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Lokasi absen berhasil disimpan');
      setIsEditing(false);
      
      logActivity({
        action: 'settings_location',
        category: 'settings',
        description: `Mengubah lokasi absen menjadi "${formData.nama}"`,
        metadata: { nama: formData.nama, latitude: formData.latitude, longitude: formData.longitude, radius: formData.radius }
      });
      
      queryClient.invalidateQueries({ queryKey: ['lokasi-absen'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal menyimpan lokasi absen');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = lokasiSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    saveMutation.mutate(result.data);
  };

  const handleCancel = () => {
    if (lokasi) {
      setFormData({
        nama: lokasi.nama,
        alamat: lokasi.alamat || '',
        latitude: Number(lokasi.latitude),
        longitude: Number(lokasi.longitude),
        radius: lokasi.radius,
      });
    } else {
      setFormData({
        nama: '',
        alamat: '',
        latitude: 0,
        longitude: 0,
        radius: 100,
      });
    }
    setErrors({});
    setIsEditing(false);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation tidak didukung browser ini');
      return;
    }

    setIsGettingLocation(true);
    
    const onSuccess = (position: GeolocationPosition) => {
      setFormData(prev => ({
        ...prev,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }));
      setIsGettingLocation(false);
      toast.success('Koordinat berhasil diambil');
    };

    const onError = (error: GeolocationPositionError) => {
      // If high accuracy times out, try with lower accuracy
      if (error.code === error.TIMEOUT) {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (fallbackError) => {
            setIsGettingLocation(false);
            let message = 'Gagal mendapatkan lokasi';
            switch (fallbackError.code) {
              case fallbackError.PERMISSION_DENIED:
                message = 'Izin lokasi ditolak. Mohon aktifkan GPS.';
                break;
              case fallbackError.POSITION_UNAVAILABLE:
                message = 'Informasi lokasi tidak tersedia.';
                break;
              case fallbackError.TIMEOUT:
                message = 'Waktu permintaan lokasi habis. Pastikan GPS aktif dan coba lagi.';
                break;
            }
            toast.error(message);
          },
          { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
        );
        return;
      }

      setIsGettingLocation(false);
      let message = 'Gagal mendapatkan lokasi';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          message = 'Izin lokasi ditolak. Mohon aktifkan GPS.';
          break;
        case error.POSITION_UNAVAILABLE:
          message = 'Informasi lokasi tidak tersedia.';
          break;
        case error.TIMEOUT:
          message = 'Waktu permintaan lokasi habis.';
          break;
      }
      toast.error(message);
    };

    // First try with high accuracy, shorter timeout
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b">
          <Skeleton className="h-6 w-48" />
        </div>
        <CardContent className="space-y-4 pt-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl overflow-hidden">
      <ExtractionCardHeader
        icon={<MapPin className="h-4 w-4 text-primary" />}
        title="Pengaturan Lokasi Absen"
        actions={
          !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )
        }
      />
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nama Lokasi */}
          <div className="space-y-2">
            <Label htmlFor="nama">Nama Lokasi <span className="text-destructive">*</span></Label>
            <Input
              id="nama"
              placeholder="Contoh: Gedung Utama Sekolah"
              value={formData.nama}
              onChange={e => setFormData(prev => ({ ...prev, nama: e.target.value }))}
              className={errors.nama ? 'border-destructive' : ''}
              disabled={!isEditing}
            />
            {errors.nama && <p className="text-xs text-destructive">{errors.nama}</p>}
          </div>

          {/* Alamat */}
          <div className="space-y-2">
            <Label htmlFor="alamat">Alamat / Keterangan</Label>
            <Textarea
              id="alamat"
              placeholder="Alamat lengkap atau keterangan tambahan (opsional)"
              value={formData.alamat}
              onChange={e => setFormData(prev => ({ ...prev, alamat: e.target.value }))}
              rows={3}
              className={errors.alamat ? 'border-destructive' : ''}
              disabled={!isEditing}
            />
            {errors.alamat && <p className="text-xs text-destructive">{errors.alamat}</p>}
          </div>

          {/* Interactive Map */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Pilih Lokasi di Peta</Label>
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGetCurrentLocation}
                  disabled={isGettingLocation}
                >
                  <Navigation className={`h-4 w-4 mr-2 ${isGettingLocation ? 'animate-spin' : ''}`} />
                  {isGettingLocation ? 'Memuat...' : 'Lokasi Saat Ini'}
                </Button>
              )}
            </div>
            <div 
              ref={mapContainerRef} 
              className={`h-[300px] w-full rounded-lg border overflow-hidden ${!isEditing ? 'opacity-75' : ''}`}
              style={{ zIndex: 1, position: 'relative' }}
            />
            {isEditing && (
              <p className="text-xs text-muted-foreground">
                Klik pada peta atau geser marker untuk menentukan titik lokasi
              </p>
            )}
          </div>

          {/* Koordinat Display */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude" className="text-sm text-muted-foreground">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="-6.123456"
                value={formData.latitude || ''}
                onChange={e => setFormData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                className={errors.latitude ? 'border-destructive' : ''}
                disabled={!isEditing}
              />
              {errors.latitude && <p className="text-xs text-destructive">{errors.latitude}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude" className="text-sm text-muted-foreground">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="106.123456"
                value={formData.longitude || ''}
                onChange={e => setFormData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                className={errors.longitude ? 'border-destructive' : ''}
                disabled={!isEditing}
              />
              {errors.longitude && <p className="text-xs text-destructive">{errors.longitude}</p>}
            </div>
          </div>

          {/* Radius */}
          <div className="space-y-2">
            <Label htmlFor="radius">Radius (meter) <span className="text-destructive">*</span></Label>
            <Input
              id="radius"
              type="number"
              placeholder="100"
              value={formData.radius || ''}
              onChange={e => setFormData(prev => ({ ...prev, radius: parseInt(e.target.value) || 0 }))}
              className={errors.radius ? 'border-destructive' : ''}
              disabled={!isEditing}
            />
            {errors.radius && <p className="text-xs text-destructive">{errors.radius}</p>}
            <p className="text-xs text-muted-foreground">
              Jarak maksimal dari titik lokasi agar dianggap "Dalam Lokasi"
            </p>
          </div>

          {/* Actions - Only show when editing and has changes */}
          {isEditing && (
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={saveMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Batal
              </Button>
              {hasChanges && (
                <Button type="submit" disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {saveMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                </Button>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
