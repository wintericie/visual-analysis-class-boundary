## Replicating Results

This guide describes how to generate Figure 3, the teaser image of our framework and the illustration of Case Study 1 in Section 6.1.

### Files
- `figure_3_teaser.png` is the Figure 3 in the paper.
- `figure_3_teaser_no_mark.png` is the Figure 3 with all markups removed, which depicts a clear result on the interface.
- `steps.mp4` illustrates the detailed interactions of the steps listed in "Steps" section. 
- The paper can be found [here](http://vader.lab.asu.edu/docs/publications/pdf/2020/llp.pdf).

### Environment

We have tested our framework in Google Chrome under Mac OS X and Ubuntu Linux. However, it should be working in most operation systems with modern web browsers and Python 3 since the implementation is based on Python and JavaScript. 

### Steps

#### 1. Projection View (Figure 3, Region C)

When the interface is loaded, the linear projection result (Figure 3 (2)) is displayed in the Projection View. The t-SNE projection result (Figure 3 (1)) can be toggled by clicking on the "T-SNE" pane on the top of the view.

#### 2. Segment Relation View (Figure 3, Region A)

The graph result in Figure 3 (Region A) should be displayed in the interface by default. For showing the patch "The Green Outlier" in Figure 3 (4), please hover the mouse pointer on the green segment glyph in the dashed red circle that connects to the patch. The corresponding points will be highlighted in the linear projection result in the Projection View. Note that it is necessary to switch to the "Linear" tab pane in the Projection View to see the result.

To view the patch "Top Features (Segment 12)" in Figure 3 (5), please hover the mouse pointer on the glyph of Segment 12 in the dashed green circle that connects to the patch. The "Top Features" can be found in the Segment Detail View, Figure 3 (Region B). The patch of "Feature Weights" on the left side of the graph can be activated in the Segment Detail View by hovering the mouse pointer on the two glyphs linked by the dashed blue arrow, respectively.

#### 3. Segment Detail View (Figure 3, Region B)

The result shown in Figure 3, Region B corresponds to the glyph of Segment 9 in the Segment Relation View. To activate it, please hover the mouse pointer on the glyph of Segment 9 in the Segment Relation View, which is the one that connects to the blue arrow beside the blue label of "2".

#### 4. Path Exploration View (Figure 3, Region D)

The result in Figure 3, Region D, represents the exploration path from Segment 2 to Segment 9 in the Segment Relation View (Figure 3 (7)). To show the path in the result, please first click on the glyph of "Segment 2" in the graph, then click on the glyph of "Segment 9". There will be a box with the title of "Selected Segments" at the top left corner of the Segment Relation View to record the order of the selected path. Please click on the button "Create a Path" in the box to activate the exploration path in the Path Exploration View. Note that if the wrong glyph is selected in the Segment Relation View, clicking on the "Clear Selections" button can reset the selection status.