"use client";

import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";

import { matchCities } from "@/lib/delivery/delivery-fee";
import type { MapPoint } from "@/lib/delivery/map-projection";
import {
  hasMapbox,
  type PlaceSuggestion,
  searchPlaces,
} from "@/lib/delivery/mapbox";
import { tidyDetail } from "@/lib/delivery/places";

/** Downtown Yangon: where suggestions lean until a pin gives a better hint. */
export const YANGON_CENTER: MapPoint = {
  latitude: 16.8409,
  longitude: 96.1735,
};

const OUTSIDE_YANGON = new Set(["Mandalay", "Nay Pyi Taw", "Bago"]);

/** Townships and cities the fee table knows, as suggestions with a ready pin. */
function localSuggestions(query: string): PlaceSuggestion[] {
  return matchCities(query).map((entry) => ({
    id: `city-${entry.city}`,
    name: entry.city,
    detail: OUTSIDE_YANGON.has(entry.city) ? "Myanmar" : "Yangon",
    point: { ...entry.point },
  }));
}

/** The label a picked place is stored under: name and area, no country. */
export function placeLabel(place: PlaceSuggestion) {
  return place.detail ? `${place.name}, ${place.detail}` : place.name;
}

/**
 * An address input with suggestions. Choosing a suggestion fills the address
 * and sets its map pin together; typing afterwards changes the text only, and
 * the parent drops the pin so it never points somewhere the text no longer says.
 */
export function AddressField({
  id,
  value,
  placeholder,
  near,
  error,
  autoComplete,
  onText,
  onPick,
  onBlur,
}: {
  id: string;
  value: string;
  placeholder: string;
  /** Pin to lean suggestions toward, such as the other end of the trip. */
  near: MapPoint | null;
  error?: string;
  autoComplete?: string;
  /** Called for typing; the parent treats any pin as stale. */
  onText: (text: string) => void;
  onPick: (place: { address: string; point: MapPoint }) => void;
  onBlur?: () => void;
}) {
  const [options, setOptions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused || value.trim().length < 3) {
      setOptions([]);
      return;
    }
    // Townships answer at once, and still do when the map service is off.
    const local = localSuggestions(value);
    setOptions(local);
    if (!hasMapbox) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchPlaces(value, near ?? YANGON_CENTER, controller.signal)
        .then((list) => {
          if (controller.signal.aborted) return;
          const taken = new Set(local.map((place) => place.name.toLowerCase()));
          setOptions([
            ...local,
            ...list
              .filter((place) => !taken.has(place.name.toLowerCase()))
              .map((place) => ({
                ...place,
                detail: tidyDetail(place.name, place.detail),
              })),
          ]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      setLoading(false);
    };
  }, [value, near, focused]);

  return (
    <Autocomplete<PlaceSuggestion, false, false, true>
      freeSolo
      id={id}
      options={options}
      loading={loading}
      // Mapbox already ranked them; filtering again would hide good matches.
      filterOptions={(list) => list}
      inputValue={value}
      getOptionLabel={(option) =>
        typeof option === "string" ? option : placeLabel(option)
      }
      isOptionEqualToValue={(a, b) =>
        typeof a !== "string" && typeof b !== "string" && a.id === b.id
      }
      onInputChange={(_event, text, reason) => {
        if (reason === "input") onText(text);
      }}
      onChange={(_event, option) => {
        if (option && typeof option !== "string")
          onPick({ address: placeLabel(option), point: option.point });
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      slotProps={{
        // The primary action is pinned to the bottom of the viewport on a
        // short phone, so a list opened below the field would sit on top of
        // the button. Flipping it above the field keeps both reachable, and
        // the list stays scrollable when the options outgrow the room.
        popper: {
          placement: "top-start",
          sx: {
            "& .MuiAutocomplete-listbox": {
              maxHeight: "min(40vh, 320px)",
              overscrollBehavior: "contain",
            },
          },
        },
      }}
      renderOption={(props, option) => {
        if (typeof option === "string") return null;
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest} sx={{ minHeight: 48 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 650 }} noWrap>
                {option.name}
              </Typography>
              {option.detail && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {option.id.startsWith("city-")
                    ? `${option.detail} · pins the centre of the area`
                    : option.detail}
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          hiddenLabel
          fullWidth
          placeholder={placeholder}
          error={Boolean(error)}
          slotProps={{
            ...params.slotProps,
            htmlInput: {
              ...params.slotProps.htmlInput,
              autoComplete: autoComplete ?? "off",
              maxLength: 300,
              enterKeyHint: "next",
              "aria-invalid": error ? true : undefined,
              "aria-describedby": error ? `${id}-error` : undefined,
            },
          }}
        />
      )}
      noOptionsText={
        value.trim().length < 3
          ? "Keep typing to see suggestions"
          : "No matches. Keep your text, or choose it on the map."
      }
      loadingText="Finding places…"
    />
  );
}
