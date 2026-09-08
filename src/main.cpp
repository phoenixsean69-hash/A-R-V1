#define GLFW_INCLUDE_NONE
#include <GLFW/glfw3.h>
#include <glad/glad.h>

#include "imgui.h"
#include "imgui_internal.h"
#include "backends/imgui_impl_glfw.h"
#include "backends/imgui_impl_opengl3.h"

#include <algorithm>
#include <array>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <string>
#include <vector>

#ifndef SFE_ASSET_DIR
#define SFE_ASSET_DIR "assets"
#endif

#define NANOSVG_IMPLEMENTATION
#include "../third_party/nanosvg/nanosvg.h"
#define NANOSVGRAST_IMPLEMENTATION
#include "../third_party/nanosvg/nanosvgrast.h"

constexpr int WINDOW_WIDTH = 1600;
constexpr int WINDOW_HEIGHT = 900;
constexpr float RIGHT_PANEL_MIN_WIDTH = 260.0f;
constexpr float RIGHT_PANEL_MAX_WIDTH = 430.0f;

static std::array<GLuint, 9> gToolIcons{};

static std::filesystem::path assetPath(const char* relative)
{
    return std::filesystem::path(SFE_ASSET_DIR) / relative;
}

static GLuint loadSvgTexture(const char* path)
{
    const std::filesystem::path relativePath(path);
    const std::array<std::filesystem::path, 5> candidates = {
        relativePath,
        std::filesystem::path(SFE_ASSET_DIR).parent_path() / relativePath,
        std::filesystem::path(SFE_ASSET_DIR) / relativePath.filename(),
        std::filesystem::current_path() / ".." / relativePath,
        std::filesystem::current_path() / ".." / ".." / relativePath
    };

    std::filesystem::path resolvedPath;
    for (const auto& candidate : candidates)
    {
        if (std::filesystem::exists(candidate))
        {
            resolvedPath = candidate;
            break;
        }
    }

    if (resolvedPath.empty())
    {
        std::fprintf(stderr, "[icons] Missing SVG: %s\n", path);
        return 0;
    }

    std::ifstream file(resolvedPath);
    if (!file) return 0;

    const std::string source((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    NSVGimage* image = nsvgParse(const_cast<char*>(source.c_str()), "px", 96.0f);
    if (!image) return 0;

    NSVGrasterizer* rasterizer = nsvgCreateRasterizer();
    if (!rasterizer)
    {
        nsvgDelete(image);
        return 0;
    }

    const int width = std::max(1, static_cast<int>(image->width));
    const int height = std::max(1, static_cast<int>(image->height));
    std::vector<unsigned char> pixels(static_cast<size_t>(width * height * 4));
    nsvgRasterize(rasterizer, image, 0.0f, 0.0f, 1.0f, pixels.data(), width, height, width * 4);

    for (size_t i = 0; i + 3 < pixels.size(); i += 4)
    {
        if (pixels[i + 3] > 0)
        {
            pixels[i] = 255;
            pixels[i + 1] = 255;
            pixels[i + 2] = 255;
        }
    }

    GLuint texture = 0;
    glGenTextures(1, &texture);
    glBindTexture(GL_TEXTURE_2D, texture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, pixels.data());
    glBindTexture(GL_TEXTURE_2D, 0);

    nsvgDeleteRasterizer(rasterizer);
    nsvgDelete(image);
    return texture;
}

static ImVec4 colorWindow()      { return ImVec4(0.024f, 0.026f, 0.029f, 1.0f); }
static ImVec4 colorPanel()       { return ImVec4(0.043f, 0.046f, 0.050f, 1.0f); }
static ImVec4 colorPanelRaised() { return ImVec4(0.060f, 0.064f, 0.069f, 1.0f); }
static ImVec4 colorBorder()      { return ImVec4(0.155f, 0.165f, 0.175f, 1.0f); }
static ImVec4 colorAccent()      { return ImVec4(0.94f, 0.64f, 0.06f, 1.0f); }
static ImVec4 colorAccentMuted() { return ImVec4(0.30f, 0.20f, 0.045f, 1.0f); }
static ImVec4 colorText()        { return ImVec4(0.90f, 0.91f, 0.92f, 1.0f); }
static ImVec4 colorMuted()       { return ImVec4(0.55f, 0.58f, 0.61f, 1.0f); }
static ImVec4 colorSuccess()     { return ImVec4(0.47f, 0.78f, 0.38f, 1.0f); }

static void applySovereignTheme()
{
    ImGui::StyleColorsDark();
    ImGuiStyle& style = ImGui::GetStyle();

    style.WindowRounding = 2.0f;
    style.ChildRounding = 3.0f;
    style.FrameRounding = 2.0f;
    style.PopupRounding = 3.0f;
    style.ScrollbarRounding = 2.0f;
    style.GrabRounding = 2.0f;
    style.TabRounding = 2.0f;
    style.WindowBorderSize = 1.0f;
    style.ChildBorderSize = 1.0f;
    style.FrameBorderSize = 1.0f;
    style.TabBorderSize = 0.0f;
    style.WindowPadding = ImVec2(10.0f, 8.0f);
    style.FramePadding = ImVec2(8.0f, 5.0f);
    style.ItemSpacing = ImVec2(7.0f, 6.0f);
    style.ItemInnerSpacing = ImVec2(6.0f, 4.0f);
    style.CellPadding = ImVec2(8.0f, 5.0f);
    style.ScrollbarSize = 12.0f;

    ImVec4* c = style.Colors;
    c[ImGuiCol_Text] = colorText();
    c[ImGuiCol_TextDisabled] = colorMuted();
    c[ImGuiCol_WindowBg] = colorWindow();
    c[ImGuiCol_ChildBg] = colorPanel();
    c[ImGuiCol_PopupBg] = colorPanelRaised();
    c[ImGuiCol_Border] = colorBorder();
    c[ImGuiCol_BorderShadow] = ImVec4(0,0,0,0);
    c[ImGuiCol_FrameBg] = ImVec4(0.075f,0.080f,0.085f,1.0f);
    c[ImGuiCol_FrameBgHovered] = ImVec4(0.105f,0.112f,0.120f,1.0f);
    c[ImGuiCol_FrameBgActive] = ImVec4(0.135f,0.142f,0.150f,1.0f);
    c[ImGuiCol_TitleBg] = ImVec4(0.040f,0.043f,0.047f,1.0f);
    c[ImGuiCol_TitleBgActive] = ImVec4(0.070f,0.074f,0.080f,1.0f);
    c[ImGuiCol_MenuBarBg] = ImVec4(0.048f,0.051f,0.055f,1.0f);
    c[ImGuiCol_Button] = ImVec4(0.085f,0.090f,0.096f,1.0f);
    c[ImGuiCol_ButtonHovered] = ImVec4(0.120f,0.126f,0.134f,1.0f);
    c[ImGuiCol_ButtonActive] = ImVec4(0.155f,0.162f,0.171f,1.0f);
    c[ImGuiCol_Header] = ImVec4(0.080f,0.084f,0.090f,1.0f);
    c[ImGuiCol_HeaderHovered] = ImVec4(0.115f,0.120f,0.128f,1.0f);
    c[ImGuiCol_HeaderActive] = ImVec4(0.145f,0.151f,0.160f,1.0f);
    c[ImGuiCol_Separator] = ImVec4(0.165f,0.175f,0.185f,1.0f);
    c[ImGuiCol_SeparatorHovered] = ImVec4(0.40f,0.42f,0.45f,1.0f);
    c[ImGuiCol_SeparatorActive] = colorAccent();
    c[ImGuiCol_CheckMark] = colorAccent();
    c[ImGuiCol_SliderGrab] = ImVec4(0.70f,0.48f,0.07f,1.0f);
    c[ImGuiCol_SliderGrabActive] = colorAccent();
    c[ImGuiCol_Tab] = ImVec4(0.065f,0.069f,0.074f,1.0f);
    c[ImGuiCol_TabHovered] = ImVec4(0.105f,0.111f,0.119f,1.0f);
    c[ImGuiCol_TabActive] = ImVec4(0.095f,0.101f,0.108f,1.0f);
    c[ImGuiCol_TabUnfocused] = ImVec4(0.050f,0.053f,0.057f,1.0f);
    c[ImGuiCol_TabUnfocusedActive] = ImVec4(0.078f,0.082f,0.088f,1.0f);
    c[ImGuiCol_TableHeaderBg] = ImVec4(0.090f,0.095f,0.102f,1.0f);
    c[ImGuiCol_TableRowBgAlt] = ImVec4(0.035f,0.038f,0.042f,1.0f);
    c[ImGuiCol_DockingPreview] = ImVec4(0.94f,0.64f,0.06f,0.28f);
}

enum class UiGlyph
{
    Folder, Hash, Calendar, Pin, Clock, Cube, Document, Bars, Pie, Image,
    Check, Link, Ruler, Marker, Speed, Momentum, Report, Info
};

enum class StatusTone { Neutral, Accent, Success };

static ImU32 toU32(const ImVec4& c) { return ImGui::ColorConvertFloat4ToU32(c); }

static ImVec4 toneColor(StatusTone tone)
{
    switch (tone)
    {
        case StatusTone::Accent: return colorAccent();
        case StatusTone::Success: return colorSuccess();
        default: return colorMuted();
    }
}

static void drawGlyph(ImDrawList* d, UiGlyph glyph, const ImVec2& center, float size, ImU32 color)
{
    const float s=size, x=center.x, y=center.y, t=std::max(1.0f,size*0.085f);

    switch (glyph)
    {
        case UiGlyph::Folder:
            d->AddRect(ImVec2(x-s*.44f,y-s*.24f),ImVec2(x+s*.44f,y+s*.30f),color,2.0f,0,t);
            d->AddLine(ImVec2(x-s*.38f,y-s*.24f),ImVec2(x-s*.16f,y-s*.42f),color,t);
            d->AddLine(ImVec2(x-s*.16f,y-s*.42f),ImVec2(x+s*.08f,y-s*.42f),color,t);
            break;
        case UiGlyph::Hash:
            d->AddLine(ImVec2(x-s*.18f,y-s*.42f),ImVec2(x-s*.28f,y+s*.42f),color,t);
            d->AddLine(ImVec2(x+s*.18f,y-s*.42f),ImVec2(x+s*.08f,y+s*.42f),color,t);
            d->AddLine(ImVec2(x-s*.40f,y-s*.12f),ImVec2(x+s*.38f,y-s*.12f),color,t);
            d->AddLine(ImVec2(x-s*.42f,y+s*.18f),ImVec2(x+s*.36f,y+s*.18f),color,t);
            break;
        case UiGlyph::Calendar:
            d->AddRect(ImVec2(x-s*.40f,y-s*.34f),ImVec2(x+s*.40f,y+s*.38f),color,2.0f,0,t);
            d->AddLine(ImVec2(x-s*.40f,y-s*.12f),ImVec2(x+s*.40f,y-s*.12f),color,t);
            d->AddLine(ImVec2(x-s*.20f,y-s*.45f),ImVec2(x-s*.20f,y-s*.25f),color,t);
            d->AddLine(ImVec2(x+s*.20f,y-s*.45f),ImVec2(x+s*.20f,y-s*.25f),color,t);
            break;
        case UiGlyph::Pin:
        case UiGlyph::Marker:
            d->AddCircle(ImVec2(x,y-s*.12f),s*.26f,color,24,t);
            d->AddCircleFilled(ImVec2(x,y-s*.12f),s*.07f,color);
            d->AddLine(ImVec2(x-s*.15f,y+s*.10f),ImVec2(x,y+s*.42f),color,t);
            d->AddLine(ImVec2(x+s*.15f,y+s*.10f),ImVec2(x,y+s*.42f),color,t);
            break;
        case UiGlyph::Clock:
            d->AddCircle(center,s*.38f,color,28,t);
            d->AddLine(center,ImVec2(x,y-s*.22f),color,t);
            d->AddLine(center,ImVec2(x+s*.19f,y+s*.12f),color,t);
            break;
        case UiGlyph::Cube:
            d->AddRect(ImVec2(x-s*.30f,y-s*.30f),ImVec2(x+s*.30f,y+s*.30f),color,1.0f,0,t);
            d->AddLine(ImVec2(x-s*.30f,y-s*.30f),ImVec2(x,y-s*.46f),color,t);
            d->AddLine(ImVec2(x+s*.30f,y-s*.30f),ImVec2(x,y-s*.46f),color,t);
            d->AddLine(ImVec2(x,y-s*.46f),ImVec2(x,y+s*.18f),color,t);
            break;
        case UiGlyph::Document:
        case UiGlyph::Report:
            d->AddRect(ImVec2(x-s*.30f,y-s*.40f),ImVec2(x+s*.30f,y+s*.40f),color,1.0f,0,t);
            d->AddLine(ImVec2(x-s*.16f,y-s*.12f),ImVec2(x+s*.16f,y-s*.12f),color,t);
            d->AddLine(ImVec2(x-s*.16f,y+s*.06f),ImVec2(x+s*.16f,y+s*.06f),color,t);
            d->AddLine(ImVec2(x-s*.16f,y+s*.24f),ImVec2(x+s*.10f,y+s*.24f),color,t);
            break;
        case UiGlyph::Bars:
            d->AddRectFilled(ImVec2(x-s*.34f,y+s*.06f),ImVec2(x-s*.20f,y+s*.38f),color);
            d->AddRectFilled(ImVec2(x-s*.07f,y-s*.16f),ImVec2(x+s*.07f,y+s*.38f),color);
            d->AddRectFilled(ImVec2(x+s*.20f,y-s*.38f),ImVec2(x+s*.34f,y+s*.38f),color);
            break;
        case UiGlyph::Pie:
            d->AddCircle(center,s*.36f,color,28,t);
            d->AddLine(center,ImVec2(x,y-s*.36f),color,t);
            d->AddLine(center,ImVec2(x+s*.30f,y+s*.20f),color,t);
            break;
        case UiGlyph::Image:
            d->AddRect(ImVec2(x-s*.42f,y-s*.32f),ImVec2(x+s*.42f,y+s*.32f),color,2.0f,0,t);
            d->AddCircleFilled(ImVec2(x+s*.20f,y-s*.12f),s*.07f,color);
            d->AddLine(ImVec2(x-s*.34f,y+s*.18f),ImVec2(x-s*.08f,y-s*.02f),color,t);
            d->AddLine(ImVec2(x-s*.08f,y-s*.02f),ImVec2(x+s*.10f,y+s*.14f),color,t);
            d->AddLine(ImVec2(x+s*.10f,y+s*.14f),ImVec2(x+s*.30f,y-s*.02f),color,t);
            break;
        case UiGlyph::Check:
            d->AddCircle(center,s*.36f,color,28,t);
            d->AddLine(ImVec2(x-s*.18f,y),ImVec2(x-s*.04f,y+s*.15f),color,t);
            d->AddLine(ImVec2(x-s*.04f,y+s*.15f),ImVec2(x+s*.20f,y-s*.16f),color,t);
            break;
        case UiGlyph::Link:
            d->AddCircle(ImVec2(x-s*.14f,y),s*.22f,color,20,t);
            d->AddCircle(ImVec2(x+s*.14f,y),s*.22f,color,20,t);
            d->AddLine(ImVec2(x-s*.06f,y),ImVec2(x+s*.06f,y),color,t);
            break;
        case UiGlyph::Ruler:
            d->AddLine(ImVec2(x-s*.36f,y+s*.28f),ImVec2(x+s*.36f,y-s*.28f),color,t*1.2f);
            for (int i=-2;i<=2;++i)
            {
                const float px=x+i*s*.12f, py=y-i*s*.09f;
                d->AddLine(ImVec2(px,py),ImVec2(px+s*.08f,py+s*.10f),color,t);
            }
            break;
        case UiGlyph::Speed:
            d->AddCircle(center,s*.36f,color,28,t);
            d->AddLine(center,ImVec2(x+s*.23f,y-s*.18f),color,t);
            d->AddCircleFilled(center,s*.05f,color);
            break;
        case UiGlyph::Momentum:
            d->AddLine(ImVec2(x-s*.34f,y),ImVec2(x+s*.02f,y),color,t);
            d->AddTriangleFilled(ImVec2(x+s*.02f,y),ImVec2(x-s*.10f,y-s*.12f),ImVec2(x-s*.10f,y+s*.12f),color);
            d->AddLine(ImVec2(x+s*.34f,y),ImVec2(x-s*.02f,y),color,t);
            d->AddTriangleFilled(ImVec2(x-s*.02f,y),ImVec2(x+s*.10f,y-s*.12f),ImVec2(x+s*.10f,y+s*.12f),color);
            break;
        case UiGlyph::Info:
            d->AddCircle(center,s*.36f,color,28,t);
            d->AddCircleFilled(ImVec2(x,y-s*.16f),s*.04f,color);
            d->AddLine(ImVec2(x,y-s*.02f),ImVec2(x,y+s*.20f),color,t);
            break;
    }
}

static void drawIconBadge(UiGlyph glyph, const ImVec2& pos, float boxSize, bool accent)
{
    ImDrawList* d=ImGui::GetWindowDrawList();
    const ImU32 bg=toU32(accent?colorAccentMuted():colorPanelRaised());
    const ImU32 border=toU32(accent?ImVec4(0.45f,0.31f,0.06f,1.0f):colorBorder());
    const ImU32 fg=toU32(accent?colorAccent():colorText());
    d->AddRectFilled(pos,ImVec2(pos.x+boxSize,pos.y+boxSize),bg,3.0f);
    d->AddRect(pos,ImVec2(pos.x+boxSize,pos.y+boxSize),border,3.0f,0,1.0f);
    drawGlyph(d,glyph,ImVec2(pos.x+boxSize*.5f,pos.y+boxSize*.5f),boxSize*.52f,fg);
}

static void beginSurface(const char* id, const ImVec2& size, bool raised=false, ImGuiWindowFlags flags=0)
{
    ImGui::PushStyleColor(ImGuiCol_ChildBg,raised?colorPanelRaised():colorPanel());
    ImGui::PushStyleColor(ImGuiCol_Border,colorBorder());
    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding,3.0f);
    ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding,ImVec2(12.0f,10.0f));
    ImGui::BeginChild(id,size,true,flags);
}

static void endSurface()
{
    ImGui::EndChild();
    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(2);
}

static void drawStatus(const char* text, StatusTone tone)
{
    const ImVec4 c=toneColor(tone);
    const ImVec2 p=ImGui::GetCursorScreenPos();
    const float h=ImGui::GetTextLineHeight();
    ImGui::GetWindowDrawList()->AddCircleFilled(ImVec2(p.x+5.0f,p.y+h*.5f),4.0f,toU32(c));
    ImGui::Dummy(ImVec2(11.0f,h));
    ImGui::SameLine(0.0f,4.0f);
    ImGui::TextColored(c,"%s",text);
}

static bool editorButton(const char* label, float width=0.0f, bool primary=false, bool enabled=true)
{
    if (!enabled) ImGui::BeginDisabled();
    if (primary)
    {
        ImGui::PushStyleColor(ImGuiCol_Button,ImVec4(0.22f,0.15f,0.035f,1.0f));
        ImGui::PushStyleColor(ImGuiCol_ButtonHovered,ImVec4(0.31f,0.21f,0.045f,1.0f));
        ImGui::PushStyleColor(ImGuiCol_ButtonActive,ImVec4(0.40f,0.27f,0.055f,1.0f));
        ImGui::PushStyleColor(ImGuiCol_Text,colorAccent());
    }
    const bool clicked=ImGui::Button(label,ImVec2(width>0.0f?width:0.0f,30.0f));
    if (primary) ImGui::PopStyleColor(4);
    if (!enabled) ImGui::EndDisabled();
    return clicked;
}

static void drawMetricTile(const char* id, UiGlyph glyph, const char* label, const char* value, const char* note, float width, float height=70.0f, bool accentIcon=false)
{
    beginSurface(id,ImVec2(width,height),true,ImGuiWindowFlags_NoScrollbar);
    const ImVec2 p=ImGui::GetCursorScreenPos();
    drawIconBadge(glyph,p,38.0f,accentIcon);
    ImGui::SetCursorScreenPos(ImVec2(p.x+50.0f,p.y+1.0f));
    ImGui::TextDisabled("%s",label);
    ImGui::Text("%s",value);
    if (note && note[0]) ImGui::TextDisabled("%s",note);
    endSurface();
}

static void drawModuleCard(const char* id, UiGlyph glyph, const char* title, const char* description, const char* status, StatusTone tone, const char* action, float width)
{
    beginSurface(id,ImVec2(width,174.0f),false,ImGuiWindowFlags_NoScrollbar);
    const ImVec2 p=ImGui::GetCursorScreenPos();
    drawIconBadge(glyph,p,40.0f,tone==StatusTone::Accent);
    ImGui::SetCursorScreenPos(ImVec2(p.x+52.0f,p.y+2.0f));
    ImGui::Text("%s",title);
    ImGui::SetCursorScreenPos(ImVec2(p.x+52.0f,p.y+27.0f));
    ImGui::PushTextWrapPos(ImGui::GetCursorPosX()+std::max(90.0f,width-70.0f));
    ImGui::TextDisabled("%s",description);
    ImGui::PopTextWrapPos();
    ImGui::SetCursorPosY(100.0f);
    drawStatus(status,tone);
    ImGui::SetCursorPosY(133.0f);
    editorButton(action,ImGui::GetContentRegionAvail().x,tone==StatusTone::Accent);
    endSurface();
}

static void drawCaseView()
{
    ImGui::Begin("Case View");

    beginSurface("CaseHeader",ImVec2(0.0f,62.0f),false,ImGuiWindowFlags_NoScrollbar);
    const ImVec2 h=ImGui::GetCursorScreenPos();
    drawIconBadge(UiGlyph::Folder,h,40.0f,true);
    ImGui::SetCursorScreenPos(ImVec2(h.x+52.0f,h.y+1.0f));
    ImGui::Text("CASE OVERVIEW");
    ImGui::TextDisabled("Build the reconstruction from one place. Review scene, evidence and analysis status.");
    const float draftWidth=108.0f;
    ImGui::SetCursorScreenPos(ImVec2(ImGui::GetWindowPos().x+ImGui::GetWindowSize().x-draftWidth-12.0f,h.y+5.0f));
    editorButton("DRAFT",draftWidth,true);
    endSurface();
    ImGui::Spacing();

    const float w=ImGui::GetContentRegionAvail().x;
    const float gap=7.0f;
    const float mw=std::max(150.0f,(w-gap*3.0f)/4.0f);
    drawMetricTile("CaseId",UiGlyph::Hash,"CASE ID","UNASSIGNED","",mw);
    ImGui::SameLine(0.0f,gap); drawMetricTile("CaseDate",UiGlyph::Calendar,"INCIDENT DATE","NOT SET","",mw);
    ImGui::SameLine(0.0f,gap); drawMetricTile("CaseLocation",UiGlyph::Pin,"LOCATION","NOT SET","",mw);
    ImGui::SameLine(0.0f,gap); drawMetricTile("CaseUpdated",UiGlyph::Clock,"LAST UPDATED","JUST NOW","",mw);
    ImGui::Spacing();

    ImGui::Text("CASE PROGRESS");
    ImGui::Separator();

    const auto progressCard=[](const char* id, UiGlyph glyph, const char* title, const char* status, StatusTone tone, float progress, const char* caption, float width)
    {
        beginSurface(id,ImVec2(width,112.0f),true,ImGuiWindowFlags_NoScrollbar);
        const ImVec2 p=ImGui::GetCursorScreenPos();
        drawIconBadge(glyph,p,34.0f,tone==StatusTone::Accent);
        ImGui::SetCursorScreenPos(ImVec2(p.x+46.0f,p.y)); ImGui::Text("%s",title);
        ImGui::SetCursorScreenPos(ImVec2(p.x+46.0f,p.y+23.0f)); drawStatus(status,tone);
        ImGui::SetCursorPosY(70.0f);
        ImGui::PushStyleColor(ImGuiCol_PlotHistogram,tone==StatusTone::Success?colorSuccess():colorAccent());
        ImGui::ProgressBar(progress,ImVec2(-1.0f,7.0f),"");
        ImGui::PopStyleColor();
        ImGui::TextDisabled("%s",caption);
        endSurface();
    };

    progressCard("SceneSetup",UiGlyph::Cube,"SCENE SETUP","READY",StatusTone::Success,1.0f,"100% complete",mw);
    ImGui::SameLine(0.0f,gap); progressCard("EvidenceReview",UiGlyph::Document,"EVIDENCE REVIEW","NOT STARTED",StatusTone::Neutral,0.0f,"0% complete",mw);
    ImGui::SameLine(0.0f,gap); progressCard("AnalysisState",UiGlyph::Bars,"ANALYSIS","NOT STARTED",StatusTone::Neutral,0.0f,"0% complete",mw);
    ImGui::SameLine(0.0f,gap); progressCard("OverallState",UiGlyph::Pie,"OVERALL PROGRESS","IN PROGRESS",StatusTone::Accent,0.18f,"18% complete",mw);
    ImGui::Spacing();

    beginSurface("IncidentSummary",ImVec2(0.0f,66.0f),false,ImGuiWindowFlags_NoScrollbar);
    const ImVec2 s=ImGui::GetCursorScreenPos();
    drawIconBadge(UiGlyph::Document,s,34.0f,false);
    ImGui::SetCursorScreenPos(ImVec2(s.x+46.0f,s.y));
    ImGui::Text("INCIDENT SUMMARY");
    ImGui::TextDisabled("No incident summary has been entered. Add essential facts, scene location and reconstruction notes.");
    const float editW=126.0f;
    ImGui::SetCursorScreenPos(ImVec2(ImGui::GetWindowPos().x+ImGui::GetWindowSize().x-editW-12.0f,s.y+8.0f));
    editorButton("EDIT SUMMARY",editW);
    endSurface();
    ImGui::Spacing();

    beginSurface("CaseContent",ImVec2(0.0f,142.0f),false,ImGuiWindowFlags_NoScrollbar);
    ImGui::Text("CASE CONTENT");
    ImGui::Separator();
    if (ImGui::BeginTable("CaseTable",3,ImGuiTableFlags_RowBg|ImGuiTableFlags_BordersInnerH|ImGuiTableFlags_SizingStretchProp))
    {
        ImGui::TableSetupColumn("CATEGORY",ImGuiTableColumnFlags_WidthStretch,0.55f);
        ImGui::TableSetupColumn("COUNT",ImGuiTableColumnFlags_WidthStretch,0.18f);
        ImGui::TableSetupColumn("STATUS",ImGuiTableColumnFlags_WidthStretch,0.27f);
        ImGui::TableHeadersRow();
        struct Row { const char* a; const char* b; const char* c; StatusTone tone; };
        const Row rows[]={{"Vehicles","2","READY",StatusTone::Success},{"Evidence","0","EMPTY",StatusTone::Neutral},{"Measurements","0","EMPTY",StatusTone::Neutral}};
        for (const auto& row:rows)
        {
            ImGui::TableNextRow();
            ImGui::TableSetColumnIndex(0); ImGui::Text("%s",row.a);
            ImGui::TableSetColumnIndex(1); ImGui::Text("%s",row.b);
            ImGui::TableSetColumnIndex(2); drawStatus(row.c,row.tone);
        }
        ImGui::EndTable();
    }
    endSurface();
    ImGui::Spacing();

    beginSurface("CaseActions",ImVec2(0.0f,50.0f),false,ImGuiWindowFlags_NoScrollbar);
    ImGui::Text("NEXT ACTIONS");
    ImGui::SameLine(150.0f); editorButton("OPEN VIEWPORT",150.0f,true);
    ImGui::SameLine(); editorButton("ADD EVIDENCE",140.0f);
    ImGui::SameLine(); editorButton("START ANALYSIS",150.0f);
    ImGui::SameLine(); editorButton("EXPORT CASE",132.0f);
    endSurface();
    ImGui::Spacing();

    beginSurface("CaseParties",ImVec2(0.0f,52.0f),false,ImGuiWindowFlags_NoScrollbar);
    ImGui::Text("INVOLVED PARTIES"); ImGui::SameLine(190.0f); ImGui::TextDisabled("No parties have been added.");
    const float partyW=110.0f;
    ImGui::SetCursorPosX(ImGui::GetWindowWidth()-partyW-14.0f); ImGui::SetCursorPosY(10.0f); editorButton("ADD PARTY",partyW);
    endSurface();

    ImGui::End();
}

static void drawEvidenceView()
{
    ImGui::Begin("Evidence");

    beginSurface("EvidenceHeader",ImVec2(0.0f,62.0f),false,ImGuiWindowFlags_NoScrollbar);
    const ImVec2 h=ImGui::GetCursorScreenPos();
    drawIconBadge(UiGlyph::Image,h,40.0f,true);
    ImGui::SetCursorScreenPos(ImVec2(h.x+52.0f,h.y+1.0f));
    ImGui::Text("EVIDENCE WORKSPACE");
    ImGui::TextDisabled("Manage and review photographs, skid marks, debris, scene markers and measurements.");
    const float importW=124.0f, addW=132.0f;
    ImGui::SetCursorScreenPos(ImVec2(ImGui::GetWindowPos().x+ImGui::GetWindowSize().x-importW-addW-24.0f,h.y+5.0f));
    editorButton("ADD EVIDENCE",addW,true); ImGui::SameLine(); editorButton("IMPORT PHOTOS",importW);
    endSurface();
    ImGui::Spacing();

    beginSurface("EvidenceFilters",ImVec2(0.0f,42.0f),false,ImGuiWindowFlags_NoScrollbar);
    editorButton("ALL",70.0f,true); ImGui::SameLine(); editorButton("PHOTOS",82.0f); ImGui::SameLine(); editorButton("SKID MARKS",106.0f);
    ImGui::SameLine(); editorButton("DEBRIS",82.0f); ImGui::SameLine(); editorButton("MEASUREMENTS",118.0f); ImGui::SameLine(); editorButton("MARKERS",88.0f);
    const float searchW=220.0f, rightEdge=ImGui::GetWindowWidth()-searchW-14.0f;
    if (rightEdge>ImGui::GetCursorPosX()+12.0f)
    {
        ImGui::SameLine(); ImGui::SetCursorPosX(rightEdge);
        static char search[128]="";
        ImGui::SetNextItemWidth(searchW);
        ImGui::InputTextWithHint("##EvidenceSearch","Search evidence...",search,sizeof(search));
    }
    endSurface();
    ImGui::Spacing();

    const float w=ImGui::GetContentRegionAvail().x, gap=7.0f, mw=std::max(150.0f,(w-gap*3.0f)/4.0f);
    drawMetricTile("EvidenceTotal",UiGlyph::Document,"TOTAL EVIDENCE","0 items","",mw);
    ImGui::SameLine(0.0f,gap); drawMetricTile("EvidenceReviewed",UiGlyph::Check,"REVIEWED","0 items","0%",mw);
    ImGui::SameLine(0.0f,gap); drawMetricTile("EvidenceLinked",UiGlyph::Link,"LINKED TO SCENE","0 items","0%",mw);
    ImGui::SameLine(0.0f,gap); drawMetricTile("EvidenceLast",UiGlyph::Clock,"LAST ADDED","NONE","No evidence yet",mw);
    ImGui::Spacing();

    ImGui::Text("EVIDENCE LIBRARY");
    ImGui::Separator();
    beginSurface("EvidenceLibrary",ImVec2(0.0f,198.0f),false,ImGuiWindowFlags_NoScrollbar);
    const ImVec2 wp=ImGui::GetWindowPos(), ws=ImGui::GetWindowSize(), center(wp.x+ws.x*.5f,wp.y+55.0f);
    drawGlyph(ImGui::GetWindowDrawList(),UiGlyph::Image,center,54.0f,toU32(colorMuted()));
    ImGui::SetCursorPosY(92.0f);
    const char* title="No evidence added yet";
    ImGui::SetCursorPosX(std::max(12.0f,(ws.x-ImGui::CalcTextSize(title).x)*.5f)); ImGui::Text("%s",title);
    const char* note="Add photos, skid marks, debris fields, markers or measurements to build the case evidence library.";
    ImGui::SetCursorPosX(std::max(12.0f,(ws.x-ImGui::CalcTextSize(note).x)*.5f)); ImGui::TextDisabled("%s",note);
    const float groupW=132.0f+7.0f+124.0f;
    ImGui::SetCursorPosX(std::max(12.0f,(ws.x-groupW)*.5f)); editorButton("ADD EVIDENCE",132.0f,true); ImGui::SameLine(); editorButton("IMPORT PHOTOS",124.0f);
    endSurface();
    ImGui::Spacing();

    ImGui::Text("EVIDENCE CATEGORIES");
    ImGui::Separator();
    const float cw=std::max(126.0f,(w-gap*4.0f)/5.0f);
    struct Cat { const char* id; UiGlyph glyph; const char* name; const char* note; };
    const Cat cats[]={
        {"Photos",UiGlyph::Image,"Photographs","Scene photos and documentation"},
        {"Skids",UiGlyph::Ruler,"Skid Marks","Tire marks and friction evidence"},
        {"Debris",UiGlyph::Document,"Debris Fields","Vehicle debris and fragments"},
        {"Markers",UiGlyph::Marker,"Scene Markers","Reference points and markers"},
        {"Measures",UiGlyph::Ruler,"Measurements","Distances, angles and dimensions"}
    };
    for (int i=0;i<5;++i)
    {
        if (i) ImGui::SameLine(0.0f,gap);
        beginSurface(cats[i].id,ImVec2(cw,102.0f),true,ImGuiWindowFlags_NoScrollbar);
        const ImVec2 p=ImGui::GetCursorScreenPos();
        drawIconBadge(cats[i].glyph,p,32.0f,true);
        ImGui::SetCursorScreenPos(ImVec2(p.x+43.0f,p.y)); ImGui::Text("%s",cats[i].name); ImGui::TextDisabled("0 items");
        ImGui::SetCursorPosY(67.0f); ImGui::PushTextWrapPos(ImGui::GetCursorPosX()+cw-22.0f); ImGui::TextDisabled("%s",cats[i].note); ImGui::PopTextWrapPos();
        endSurface();
    }
    ImGui::Spacing();

    beginSurface("EvidenceInspector",ImVec2(0.0f,64.0f),false,ImGuiWindowFlags_NoScrollbar);
    const ImVec2 p=ImGui::GetCursorScreenPos();
    drawIconBadge(UiGlyph::Info,p,34.0f,false);
    ImGui::SetCursorScreenPos(ImVec2(p.x+46.0f,p.y)); ImGui::TextDisabled("EVIDENCE INSPECTOR"); ImGui::Text("SELECT AN ITEM TO INSPECT");
    ImGui::SameLine(0.0f,12.0f); ImGui::TextDisabled("Choose an evidence item to view details, metadata and scene links.");
    endSurface();

    ImGui::End();
}

static void drawAnalysisView()
{
    ImGui::Begin("Analysis");

    beginSurface("AnalysisHeader",ImVec2(0.0f,62.0f),false,ImGuiWindowFlags_NoScrollbar);
    const ImVec2 h=ImGui::GetCursorScreenPos();
    drawIconBadge(UiGlyph::Bars,h,40.0f,true);
    ImGui::SetCursorScreenPos(ImVec2(h.x+52.0f,h.y+1.0f)); ImGui::Text("ANALYSIS WORKSPACE");
    ImGui::TextDisabled("Perform technical analysis using case evidence to reconstruct vehicle dynamics and incident sequence.");
    const float guideW=126.0f;
    ImGui::SetCursorScreenPos(ImVec2(ImGui::GetWindowPos().x+ImGui::GetWindowSize().x-guideW-12.0f,h.y+5.0f)); editorButton("ANALYSIS GUIDE",guideW,true);
    endSurface();
    ImGui::Spacing();

    const float w=ImGui::GetContentRegionAvail().x, gap=7.0f, mw=std::max(150.0f,(w-gap*3.0f)/4.0f);
    drawMetricTile("Ready",UiGlyph::Check,"ANALYSIS READINESS","NOT READY","Link required evidence",mw,76.0f,true);
    ImGui::SameLine(0.0f,gap); drawMetricTile("Linked",UiGlyph::Document,"EVIDENCE LINKED","0 OF 2","No measurements linked",mw,76.0f);
    ImGui::SameLine(0.0f,gap); drawMetricTile("CaseState",UiGlyph::Folder,"CASE STATE","UNASSIGNED","Set date and location",mw,76.0f);
    ImGui::SameLine(0.0f,gap); drawMetricTile("Updated",UiGlyph::Clock,"LAST UPDATED","JUST NOW","No analysis has been run",mw,76.0f);
    ImGui::Spacing();

    ImGui::Text("ANALYSIS MODULES");
    ImGui::Separator();
    const float modW=std::max(170.0f,(w-gap*3.0f)/4.0f);
    drawModuleCard("SkidModule",UiGlyph::Ruler,"SKID ANALYSIS","Calculate vehicle speed from skid distance, friction and surface data.","NOT STARTED",StatusTone::Neutral,"CONFIGURE",modW);
    ImGui::SameLine(0.0f,gap); drawModuleCard("MomentumModule",UiGlyph::Momentum,"MOMENTUM ANALYSIS","Analyze vehicle motion using conservation of momentum and collision dynamics.","AWAITING EVIDENCE",StatusTone::Accent,"OPEN",modW);
    ImGui::SameLine(0.0f,gap); drawModuleCard("SpeedModule",UiGlyph::Speed,"SPEED ANALYSIS","Determine vehicle speed from crush, throw distance and simulation evidence.","AWAITING EVIDENCE",StatusTone::Accent,"OPEN",modW);
    ImGui::SameLine(0.0f,gap); drawModuleCard("ResultsModule",UiGlyph::Report,"RECONSTRUCTION RESULTS","Compile analysis outputs into the complete incident reconstruction and report.","NOT STARTED",StatusTone::Neutral,"OPEN",modW);
    ImGui::Spacing();

    beginSurface("Pipeline",ImVec2(0.0f,108.0f),false,ImGuiWindowFlags_NoScrollbar);
    ImGui::Text("ANALYSIS PIPELINE"); ImGui::SameLine(0.0f,10.0f); ImGui::TextDisabled("Follow the workflow from evidence collection through reporting.");
    ImGui::Separator();
    struct Step { int n; const char* title; const char* note; StatusTone tone; };
    const Step steps[]={
        {1,"Collect Evidence","Add skid marks, debris and measurements.",StatusTone::Accent},
        {2,"Link Measurements","Associate evidence with scene elements.",StatusTone::Neutral},
        {3,"Run Analysis","Configure and execute analysis modules.",StatusTone::Neutral},
        {4,"Review Results","Validate outputs and generate reports.",StatusTone::Neutral}
    };
    const float pw=ImGui::GetContentRegionAvail().x, sw=pw/4.0f;
    const ImVec2 start=ImGui::GetCursorScreenPos();
    for (int i=0;i<4;++i)
    {
        const float sx=start.x+i*sw; const ImVec4 c=toneColor(steps[i].tone);
        ImGui::GetWindowDrawList()->AddCircle(ImVec2(sx+18.0f,start.y+23.0f),16.0f,toU32(c),24,2.0f);
        char n[8]{}; std::snprintf(n,sizeof(n),"%d",steps[i].n); const ImVec2 ns=ImGui::CalcTextSize(n);
        ImGui::GetWindowDrawList()->AddText(ImVec2(sx+18.0f-ns.x*.5f,start.y+23.0f-ns.y*.5f),toU32(c),n);
        ImGui::SetCursorScreenPos(ImVec2(sx+44.0f,start.y+5.0f)); ImGui::Text("%s",steps[i].title);
        ImGui::SetCursorScreenPos(ImVec2(sx+44.0f,start.y+30.0f)); ImGui::PushTextWrapPos(sx+sw-16.0f); ImGui::TextDisabled("%s",steps[i].note); ImGui::PopTextWrapPos();
        if (i<3)
        {
            const float ax=sx+sw-18.0f;
            ImGui::GetWindowDrawList()->AddLine(ImVec2(ax-8.0f,start.y+23.0f),ImVec2(ax+8.0f,start.y+23.0f),toU32(colorMuted()),1.5f);
            ImGui::GetWindowDrawList()->AddTriangleFilled(ImVec2(ax+10.0f,start.y+23.0f),ImVec2(ax+3.0f,start.y+18.0f),ImVec2(ax+3.0f,start.y+28.0f),toU32(colorMuted()));
        }
    }
    endSurface();
    ImGui::Spacing();

    beginSurface("AnalysisResults",ImVec2(0.0f,78.0f),false,ImGuiWindowFlags_NoScrollbar);
    const ImVec2 rp=ImGui::GetCursorScreenPos();
    drawIconBadge(UiGlyph::Report,rp,38.0f,false);
    ImGui::SetCursorScreenPos(ImVec2(rp.x+50.0f,rp.y)); ImGui::Text("RESULTS & INSIGHTS");
    ImGui::TextDisabled("No analysis results yet. Link evidence and run an analysis module to generate outputs.");
    const float reportW=118.0f;
    ImGui::SetCursorScreenPos(ImVec2(ImGui::GetWindowPos().x+ImGui::GetWindowSize().x-reportW-12.0f,rp.y+10.0f)); editorButton("VIEW REPORTS",reportW,false,false);
    endSurface();
    ImGui::Spacing();

    beginSurface("AnalysisActions",ImVec2(0.0f,50.0f),false,ImGuiWindowFlags_NoScrollbar);
    ImGui::Text("QUICK ACTIONS"); ImGui::SameLine(150.0f); editorButton("START SKID ANALYSIS",178.0f,true);
    ImGui::SameLine(); editorButton("LINK EVIDENCE",140.0f); ImGui::SameLine(); editorButton("RUN ALL ANALYSES",150.0f,false,false);
    endSurface();

    ImGui::End();
}

static void drawRailButton(const char* id, const char* label, int iconIndex, bool active, bool* clicked)
{
    ImGui::PushID(id);
    const float width=std::max(1.0f,ImGui::GetContentRegionAvail().x), height=58.0f;
    const ImVec2 pos=ImGui::GetCursorScreenPos();
    ImGui::InvisibleButton("##Rail",ImVec2(width,height));
    const bool hovered=ImGui::IsItemHovered();
    if (clicked) *clicked=ImGui::IsItemClicked();
    ImDrawList* d=ImGui::GetWindowDrawList();
    if (active)
    {
        d->AddRectFilled(pos,ImVec2(pos.x+width,pos.y+height),IM_COL32(57,41,12,255),3.0f);
        d->AddRect(pos,ImVec2(pos.x+width,pos.y+height),IM_COL32(225,157,17,170),3.0f,0,1.0f);
        d->AddRectFilled(ImVec2(pos.x,pos.y+7.0f),ImVec2(pos.x+3.0f,pos.y+height-7.0f),IM_COL32(238,174,38,255));
    }
    else if (hovered) d->AddRectFilled(pos,ImVec2(pos.x+width,pos.y+height),IM_COL32(31,34,37,255),3.0f);

    const float iconSize=22.0f;
    if (iconIndex>=0 && iconIndex<(int)gToolIcons.size() && gToolIcons[(size_t)iconIndex])
    {
        d->AddImage((ImTextureID)gToolIcons[(size_t)iconIndex],ImVec2(pos.x+(width-iconSize)*.5f,pos.y+6.0f),ImVec2(pos.x+(width+iconSize)*.5f,pos.y+6.0f+iconSize),ImVec2(0,0),ImVec2(1,1),active?IM_COL32(255,190,51,255):IM_COL32(225,228,232,255));
    }
    const ImVec2 ls=ImGui::CalcTextSize(label);
    d->AddText(ImVec2(pos.x+(width-ls.x)*.5f,pos.y+35.0f),active?IM_COL32(255,184,35,255):(hovered?IM_COL32(224,226,229,255):IM_COL32(155,160,166,255)),label);
    ImGui::PopID();
}

static void drawViewportView()
{
    static int selectedTool=0;
    static bool showGrid=true, showAxes=true;
    ImGui::Begin("Viewport");
    ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding,ImVec2(7.0f,7.0f));
    ImGui::BeginChild("ViewportToolRail",ImVec2(112.0f,0.0f),true,ImGuiWindowFlags_NoScrollbar);
    bool clicked=false;
    drawRailButton("select","SELECT",0,selectedTool==0,&clicked); if (clicked) selectedTool=0;
    drawRailButton("move","MOVE",1,selectedTool==1,&clicked); if (clicked) selectedTool=1;
    drawRailButton("rotate","ROTATE",2,selectedTool==2,&clicked); if (clicked) selectedTool=2;
    drawRailButton("scale","SCALE",3,selectedTool==3,&clicked); if (clicked) selectedTool=3;
    ImGui::Separator();
    drawRailButton("vehicle","VEHICLE",4,false,&clicked);
    drawRailButton("evidence","EVIDENCE",5,false,&clicked);
    drawRailButton("measure","MEASURE",6,false,&clicked);
    ImGui::Separator();
    drawRailButton("grid","GRID",7,showGrid,&clicked); if (clicked) showGrid=!showGrid;
    drawRailButton("axes","AXES",8,showAxes,&clicked); if (clicked) showAxes=!showAxes;
    ImGui::EndChild();

    ImGui::SameLine(0.0f,6.0f);
    ImGui::BeginChild("SceneCanvas",ImGui::GetContentRegionAvail(),true,ImGuiWindowFlags_NoScrollbar|ImGuiWindowFlags_NoScrollWithMouse);
    const ImVec2 cp=ImGui::GetWindowPos(), cs=ImGui::GetWindowSize();
    ImDrawList* d=ImGui::GetWindowDrawList();
    d->AddRectFilled(cp,ImVec2(cp.x+cs.x,cp.y+cs.y),IM_COL32(18,20,22,255));
    if (showGrid)
    {
        const float gs=32.0f;
        for (float x=cp.x;x<cp.x+cs.x;x+=gs) d->AddLine(ImVec2(x,cp.y),ImVec2(x,cp.y+cs.y),IM_COL32(49,52,55,255));
        for (float y=cp.y;y<cp.y+cs.y;y+=gs) d->AddLine(ImVec2(cp.x,y),ImVec2(cp.x+cs.x,y),IM_COL32(49,52,55,255));
    }
    const ImVec2 center(cp.x+cs.x*.5f,cp.y+cs.y*.5f);
    d->AddCircleFilled(center,7.0f,IM_COL32(238,174,38,255));
    if (showAxes)
    {
        d->AddLine(center,ImVec2(center.x+100.0f,center.y),IM_COL32(190,65,55,255),2.0f);
        d->AddLine(center,ImVec2(center.x,center.y-100.0f),IM_COL32(70,145,80,255),2.0f);
        d->AddText(ImVec2(center.x+105.0f,center.y-10.0f),IM_COL32(220,90,75,255),"X");
        d->AddText(ImVec2(center.x+7.0f,center.y-120.0f),IM_COL32(100,190,110,255),"Y");
    }
    d->AddText(ImVec2(cp.x+16.0f,cp.y+16.0f),IM_COL32(225,226,228,255),"SCENE VIEWPORT");
    d->AddText(ImVec2(cp.x+16.0f,cp.y+40.0f),IM_COL32(135,139,145,255),"No scene objects loaded");
    ImGui::EndChild();
    ImGui::PopStyleVar();
    ImGui::End();
}

static void drawOutliner()
{
    ImGui::Begin("Outliner",nullptr,ImGuiWindowFlags_NoMove);
    ImGui::Text("SCENE OUTLINER"); ImGui::Separator();
    if (ImGui::TreeNodeEx("Environment",ImGuiTreeNodeFlags_DefaultOpen))
    { ImGui::BulletText("Ground Plane"); ImGui::BulletText("Road Surface"); ImGui::TreePop(); }
    if (ImGui::TreeNodeEx("Vehicles",ImGuiTreeNodeFlags_DefaultOpen))
    { ImGui::Selectable("Vehicle A"); ImGui::Selectable("Vehicle B"); ImGui::TreePop(); }
    if (ImGui::TreeNode("Evidence"))
    { ImGui::Selectable("Skid Mark 01"); ImGui::Selectable("Marker 01"); ImGui::Selectable("Debris Field 01"); ImGui::TreePop(); }
    if (ImGui::TreeNode("Measurements"))
    { ImGui::Selectable("Distance 01"); ImGui::Selectable("Angle 01"); ImGui::TreePop(); }
    ImGui::End();
}

static void drawProperties()
{
    ImGui::Begin("Properties",nullptr,ImGuiWindowFlags_NoMove);
    ImGui::Text("INSPECTOR"); ImGui::Separator(); ImGui::TextDisabled("Nothing selected"); ImGui::Spacing();
    if (ImGui::CollapsingHeader("Transform",ImGuiTreeNodeFlags_DefaultOpen))
    {
        static float position[3]={0,0,0}, rotation[3]={0,0,0}, scale[3]={1,1,1};
        ImGui::DragFloat3("Position",position,0.1f); ImGui::DragFloat3("Rotation",rotation,1.0f); ImGui::DragFloat3("Scale",scale,0.01f);
    }
    if (ImGui::CollapsingHeader("Metadata"))
    {
        static char name[128]="Untitled Object";
        ImGui::InputText("Name",name,sizeof(name)); ImGui::Text("Type: Scene Entity"); ImGui::Text("Units: meters");
    }
    if (ImGui::CollapsingHeader("Analysis"))
    { ImGui::TextDisabled("No analysis data available."); ImGui::TextDisabled("Add evidence to begin."); }
    ImGui::End();
}

static void drawTimeline()
{
    static int frame=1, speedIndex=1;
    static float position=0.0f;
    ImGui::Begin("Timeline");
    ImGui::Text("TIMELINE"); ImGui::SameLine();
    if (editorButton("|<",34.0f)) { frame=1; position=0.0f; }
    ImGui::SameLine(); editorButton("Play",48.0f); ImGui::SameLine(); if (editorButton("Stop",48.0f)) frame=1;
    ImGui::SameLine(); ImGui::Text("Frame"); ImGui::SameLine(); ImGui::SetNextItemWidth(100.0f); ImGui::DragInt("##Frame",&frame,1.0f,1,1000);
    ImGui::SameLine(0.0f,12.0f); ImGui::TextDisabled("Pre-impact  >  Impact  >  Rest");
    const float speedW=70.0f; ImGui::SameLine(); ImGui::SetCursorPosX(ImGui::GetWindowWidth()-speedW-14.0f);
    const char* speeds[]={"0.5x","1x","2x"}; ImGui::SetNextItemWidth(speedW); ImGui::Combo("##Speed",&speedIndex,speeds,3);
    ImGui::Separator(); ImGui::PushStyleColor(ImGuiCol_SliderGrab,colorAccent()); ImGui::PushStyleColor(ImGuiCol_SliderGrabActive,colorAccent());
    ImGui::SetNextItemWidth(-1.0f); ImGui::SliderFloat("##TimelinePosition",&position,0.0f,100.0f,"%.0f"); ImGui::PopStyleColor(2);
    ImGui::End();
}

static void enforceRightPanelBounds(ImGuiID rightNodeId)
{
    ImGuiDockNode* rightNode=ImGui::DockBuilderGetNode(rightNodeId);
    if (!rightNode) return;
    ImGuiDockNode* parent=rightNode->ParentNode;
    if (!parent || parent->SplitAxis!=ImGuiAxis_X) return;
    const float screenWidth=ImGui::GetMainViewport()->WorkSize.x;
    float desired=std::clamp(rightNode->Size.x,RIGHT_PANEL_MIN_WIDTH,RIGHT_PANEL_MAX_WIDTH);
    if (parent->ChildNodes[1]==rightNode)
    {
        const float splitX=parent->Pos.x+parent->Size.x-desired;
        if (parent->ChildNodes[0]) parent->ChildNodes[0]->SizeRef.x=splitX-parent->Pos.x;
        if (parent->ChildNodes[1]) parent->ChildNodes[1]->SizeRef.x=desired;
    }
    else rightNode->SizeRef.x=desired;
    if (screenWidth<RIGHT_PANEL_MAX_WIDTH+RIGHT_PANEL_MIN_WIDTH) rightNode->SizeRef.x=std::max(180.0f,screenWidth*.28f);
}

static void drawMainMenuBar()
{
    if (!ImGui::BeginMainMenuBar()) return;
    if (ImGui::BeginMenu("File")) { ImGui::MenuItem("New Case"); ImGui::MenuItem("Open Case"); ImGui::MenuItem("Save Case"); ImGui::Separator(); ImGui::MenuItem("Exit"); ImGui::EndMenu(); }
    if (ImGui::BeginMenu("Edit")) { ImGui::MenuItem("Undo"); ImGui::MenuItem("Redo"); ImGui::EndMenu(); }
    if (ImGui::BeginMenu("View")) { ImGui::MenuItem("Outliner"); ImGui::MenuItem("Properties"); ImGui::MenuItem("Timeline"); ImGui::EndMenu(); }
    if (ImGui::BeginMenu("Scene")) { ImGui::MenuItem("Add Vehicle"); ImGui::MenuItem("Add Evidence"); ImGui::MenuItem("Add Measurement"); ImGui::EndMenu(); }
    if (ImGui::BeginMenu("Analysis")) { ImGui::MenuItem("Skid Analysis"); ImGui::MenuItem("Momentum Analysis"); ImGui::MenuItem("Speed Analysis"); ImGui::EndMenu(); }
    if (ImGui::BeginMenu("Help")) { ImGui::MenuItem("About Sovereign"); ImGui::EndMenu(); }
    ImGui::EndMainMenuBar();
}

static void drawInterface()
{
    static bool layoutBuilt=false;
    static ImGuiID rightDockNodeId=0;
    drawMainMenuBar();

    ImGuiViewport* viewport=ImGui::GetMainViewport();
    ImGui::SetNextWindowPos(viewport->WorkPos);
    ImGui::SetNextWindowSize(viewport->WorkSize);
    ImGui::SetNextWindowViewport(viewport->ID);

    const ImGuiWindowFlags hostFlags=ImGuiWindowFlags_NoTitleBar|ImGuiWindowFlags_NoCollapse|ImGuiWindowFlags_NoResize|ImGuiWindowFlags_NoMove|ImGuiWindowFlags_NoBringToFrontOnFocus|ImGuiWindowFlags_NoNavFocus|ImGuiWindowFlags_NoBackground;
    ImGui::Begin("Sovereign Workspace",nullptr,hostFlags);
    const ImGuiID dockspace=ImGui::GetID("SovereignDockspace");
    ImGui::DockSpace(dockspace,ImVec2(0,0),ImGuiDockNodeFlags_PassthruCentralNode);

    if (!layoutBuilt)
    {
        ImGui::DockBuilderRemoveNode(dockspace);
        ImGui::DockBuilderAddNode(dockspace,ImGuiDockNodeFlags_DockSpace);
        ImGui::DockBuilderSetNodeSize(dockspace,viewport->WorkSize);
        ImGuiID center=dockspace, right=0, bottom=0, rightTop=0;
        ImGui::DockBuilderSplitNode(center,ImGuiDir_Right,0.245f,&right,&center);
        rightDockNodeId=right;
        ImGui::DockBuilderSplitNode(center,ImGuiDir_Down,0.16f,&bottom,&center);
        ImGui::DockBuilderSplitNode(right,ImGuiDir_Up,0.46f,&rightTop,&right);
        ImGui::DockBuilderDockWindow("Case View",center);
        ImGui::DockBuilderDockWindow("Evidence",center);
        ImGui::DockBuilderDockWindow("Analysis",center);
        ImGui::DockBuilderDockWindow("Viewport",center);
        ImGui::DockBuilderDockWindow("Timeline",bottom);
        ImGui::DockBuilderDockWindow("Outliner",rightTop);
        ImGui::DockBuilderDockWindow("Properties",right);
        ImGui::DockBuilderFinish(dockspace);
        layoutBuilt=true;
    }

    ImGui::End();
    if (rightDockNodeId) enforceRightPanelBounds(rightDockNodeId);
    drawCaseView();
    drawEvidenceView();
    drawAnalysisView();
    drawViewportView();
    drawOutliner();
    drawProperties();
    drawTimeline();
}

int main()
{
    if (!glfwInit()) { std::printf("[FATAL] Failed to initialize GLFW.\n"); return -1; }
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR,4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR,6);
    glfwWindowHint(GLFW_OPENGL_PROFILE,GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_RESIZABLE,GLFW_TRUE);

    GLFWwindow* window=glfwCreateWindow(WINDOW_WIDTH,WINDOW_HEIGHT,"Sovereign Accident Reconstructor v0.1.0 - OpenGL 4.6",nullptr,nullptr);
    if (!window) { glfwTerminate(); return -1; }
    glfwMakeContextCurrent(window);
    glfwSwapInterval(1);
    if (!gladLoadGLLoader(reinterpret_cast<GLADloadproc>(glfwGetProcAddress))) { glfwDestroyWindow(window); glfwTerminate(); return -1; }

    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io=ImGui::GetIO();
    io.IniFilename=nullptr;
    io.ConfigFlags|=ImGuiConfigFlags_NavEnableKeyboard;
    io.ConfigFlags|=ImGuiConfigFlags_DockingEnable;
    applySovereignTheme();

    const std::filesystem::path rubikPath=assetPath("fonts/Rubik-Regular.ttf");
    ImFont* rubik=io.Fonts->AddFontFromFileTTF(rubikPath.string().c_str(),16.0f);
    if (!rubik) std::printf("[WARN] Could not load %s\n",rubikPath.string().c_str());

    if (!ImGui_ImplGlfw_InitForOpenGL(window,true)) { ImGui::DestroyContext(); glfwDestroyWindow(window); glfwTerminate(); return -1; }
    if (!ImGui_ImplOpenGL3_Init("#version 460")) { ImGui_ImplGlfw_Shutdown(); ImGui::DestroyContext(); glfwDestroyWindow(window); glfwTerminate(); return -1; }

    const char* iconPaths[]={
        "assets/icons/blender/select.svg","assets/icons/blender/move.svg","assets/icons/blender/rotate.svg",
        "assets/icons/blender/scale.svg","assets/icons/blender/vehicle.svg","assets/icons/blender/evidence.svg",
        "assets/icons/blender/measure.svg","assets/icons/blender/grid.svg","assets/icons/blender/axes.svg"
    };
    for (size_t i=0;i<gToolIcons.size();++i) gToolIcons[i]=loadSvgTexture(iconPaths[i]);

    while (!glfwWindowShouldClose(window))
    {
        glfwPollEvents();
        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplGlfw_NewFrame();
        ImGui::NewFrame();
        if (rubik) ImGui::PushFont(rubik);
        drawInterface();
        if (rubik) ImGui::PopFont();
        ImGui::Render();
        glClearColor(0.024f,0.026f,0.029f,1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
        glfwSwapBuffers(window);
    }

    for (GLuint& texture:gToolIcons) if (texture) glDeleteTextures(1,&texture);
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
